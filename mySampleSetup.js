const express = require('express')
const bodyParser = require('body-parser')
const http = require('http')

const readline = require('readline')
const fs = require('fs')
const sdk = require('verity-sdk')
const request = require('request-promise-native')
const Spinner = require('cli-spinner').Spinner
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
const ANSII_GREEN = '\u001b[32m'
const ANSII_RESET = '\x1b[0m'
const CONFIG_PATH = 'verity-context.json'
const LISTENING_PORT = 4000
const INSTITUTION_NAME = 'AZir College'
const LOGO_URL = 'http://robohash.org/235'
const handlers = new sdk.Handlers()
let listener

let context
let issuerDID
let issuerVerkey

main().then(console.log('Done'))

async function provisionAgent() {
    var token = null
    if (await readlineYesNo('Provide Provision Token', true)) {
        token = await readlineInput('Token', process.env.TOKEN)
        token.trim()
        console.log(`Using provision token: ${ANSII_GREEN}${token}${ANSII_RESET}`)
    }

    var verityUrl = await readlineInput('Verity Application Endpoint', process.env.VERITY_SERVER)
    verityUrl = verityUrl.trim()
    if (verityUrl === '') {
        verityUrl = 'http://localhost:9000'
    }

    console.log(`Using Verity Application Endpoint Url: ${ANSII_GREEN}${verityUrl}${ANSII_RESET}`)

    // create initial Context
    var ctx = await sdk.Context.create('examplewallet1', 'examplewallet1', verityUrl, '')
    console.log('wallet created')
    const provision = new sdk.protocols.v0_7.Provision(null, token)
    console.log('provision object')

    // ask that an agent by provision (setup) and associated with created key pair
    return provision.provision(ctx)
}

async function setup() {
    // if (fs.existsSync(CONFIG_PATH)) {
    //   if (await readlineYesNo('Reuse Verity Context (in ' + CONFIG_PATH + ')', true)) {
    //     context = await loadContext(CONFIG_PATH)
    //   } else {
    //     context = await provisionAgent()
    //   }
    // } else {
    context = await provisionAgent()
    // }

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(context.getConfig()))

    await updateWebhookEndpoint()

    printObject(context.getConfig(), '>>>', 'Context Used:')

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(context.getConfig()))

    await updateConfigs()

    await issuerIdentifier()

    console.log(issuerDID)

    if (issuerDID == null) {
        await setupIssuer()
    }
}

async function updateWebhookEndpoint() {
    var webhookFromCtx = context.endpointUrl

    var webhook = await readlineInput(`Ngrok endpoint for port(${LISTENING_PORT})[${webhookFromCtx}]`, process.env.WEBHOOK_URL)
    if (webhook === '') {
        webhook = webhookFromCtx
    }

    console.log(`Using Webhook: ${ANSII_GREEN}${webhook}${ANSII_RESET}`)
    context.endpointUrl = webhook

    // request that verity application use specified webhook endpoint
    await new sdk.protocols.UpdateEndpoint().update(context)
}

function printObject(obj, prefix, preamble) {
    console.log()
    console.log(prefix + '  ' + preamble)
    var lines = JSON.stringify(obj, null, 2).split('\n')
    lines.forEach(line => {
        console.log(prefix + '  ' + line)
    })
    console.log()
}

async function updateConfigs() {
    const updateConfigs = new sdk.protocols.UpdateConfigs(INSTITUTION_NAME, LOGO_URL)
    await updateConfigs.update(context)
}

async function issuerIdentifier() {
    // constructor for the Issuer Setup protocol
    const issuerSetup = new sdk.protocols.IssuerSetup()
    var spinner = new Spinner('Waiting for current issuer DID ... %s').setSpinnerDelay(450)

    // handler for current issuer identifier message
    var step = new Promise((resolve) => {
        handlers.addHandler(issuerSetup.msgFamily, issuerSetup.msgFamilyVersion, async (msgName, message) => {
            spinner.stop()
            switch (msgName) {
                case issuerSetup.msgNames.PUBLIC_IDENTIFIER:
                    printMessage(msgName, message)
                    issuerDID = message.did
                    issuerVerkey = message.verKey
                    break
            }
            resolve(null)
        })
    })

    spinner.start()
    // query the current identifier
    await issuerSetup.currentPublicIdentifier(context)
    return step // wait for response from verity application
}

async function setupIssuer() {
    // constructor for the Issuer Setup protocol
    const issuerSetup = new sdk.protocols.IssuerSetup()
    var spinner = new Spinner('Waiting for setup to complete ... %s').setSpinnerDelay(450) // Console spinner

    // handler for created issuer identifier message
    var step = new Promise((resolve) => {
        handlers.addHandler(issuerSetup.msgFamily, issuerSetup.msgFamilyVersion, async (msgName, message) => {
            switch (msgName) {
                case issuerSetup.msgNames.PUBLIC_IDENTIFIER_CREATED:
                    spinner.stop()
                    printMessage(msgName, message)
                    issuerDID = message.identifier.did
                    issuerVerkey = message.identifier.verKey
                    console.log('The issuer DID and Verkey must be registered on the ledger.')
                    var automatedRegistration = await readlineYesNo('Attempt automated registration via https://selfserve.sovrin.org', true)
                    if (automatedRegistration) {
                        var res = await request.post({
                            uri: 'https://selfserve.sovrin.org/nym',
                            json: {
                                network: 'stagingnet',
                                did: issuerDID,
                                verkey: issuerVerkey,
                                paymentaddr: ''
                            }
                        })
                        if (res.statusCode !== 200) {
                            console.log('Something went wrong with contactig Sovrin portal')
                            console.log(`Please add DID (${issuerDID}) and Verkey (${issuerVerkey}) to ledger manually`)
                            await readlineInput('Press ENTER when DID is on ledger')
                        } else {
                            console.log(`Got response from Sovrin portal: ${ANSII_GREEN}${res.body}${ANSII_RESET}`)
                        }
                    } else {
                        console.log(`Please add DID (${issuerDID}) and Verkey (${issuerVerkey}) to ledger manually`)
                        await readlineInput('Press ENTER when DID is on ledger')
                    }
                    resolve(null)
                    break
                default:
                    printMessage(msgName, message)
                    nonHandle('Message Name is not handled - ' + msgName)
            }
        })
    })

    spinner.start()
    // request that issuer identifier be created
    await issuerSetup.create(context)
    return step // wait for request to complete
}  

async function readlineYesNo (request, defaultYes) {
    var yesNo = defaultYes ? '[y]/n' : 'y/n'
    var modifiedRequest = request + '? ' + yesNo + ': '
  
    return new Promise((resolve) => {
      rl.question(modifiedRequest, (response) => {
        var normalized = response.trim().toLocaleLowerCase()
        if (defaultYes && normalized === '') {
          resolve(true)
        } else if (normalized === 'y') {
          resolve(true)
        } else if (normalized === 'n') {
          resolve(false)
        } else {
          console.error("Did not get a valid response -- '" + response + "' is not y or n")
          process.exit(-1)
        }
      })
    })
  }
  
  async function readlineInput (request, defaultValue) {
    console.log()
  
    return new Promise((resolve) => {
      if (defaultValue) {
        console.log(`${request}:`)
        console.log(`${ANSII_GREEN}${defaultValue}${ANSII_RESET} is set via environment variable`)
        rl.question('Press any key to continue', (response) => { resolve(defaultValue) })
      } else {
        rl.question(request + ': ', (response) => { resolve(response) })
      }
    })
  }
  
  async function main () {
    await start()
    await setup()
    await end()
  }
  
  async function start () {
    const app = express()
    app.use(bodyParser.text({
      type: function (_) {
        return 'text'
      }
    }))
  
    app.post('/', async (req, res) => {
      await handlers.handleMessage(context, Buffer.from(req.body, 'utf8'))
      res.send('Success')
    })
  
    listener = http.createServer(app).listen(LISTENING_PORT)
    console.log(`Listening on port ${LISTENING_PORT}`)
  }
  
  async function end () {
    listener.close()
    rl.close()
    process.exit(0)
  }
  
  function printMessage (msgName, msg) {
    printObject(msg, '<<<', `Incomming Message -- ${msgName}`)
  }
  