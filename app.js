
// const ctx = await helpers.getTestContext()
// const p = new Provision()
// const msg = p.provisionMsg(ctx)
// expect(msg.requesterVk).to.equal(ctx.sdkVerKey)

// const testToken = '{"sponseeId": "myId", "sponsorId": "evernym-test-sponsorabc123", "nonce": "123", "timestamp": "2020-06-05T21:33:36.085Z", "sig": "ZkejifRr3txh7NrKokC5l2D2YcABUlGlAoFHZD9RapHHBfVtNnHgYux1RCAiEh4Q31VJE3C92T1ZnqDm1WlEAA==", "sponsorVerKey": "GJ1SzoWzavQYfNL9XkaJdrQejfztN4XqdsiV4ct3LXKL"}'
// const p2 = new Provision(null, testToken)
// const msg2 = p2.provisionMsg(ctx)
// expect(msg2.provisionToken)

const verity = require('verity-sdk');
const { Context } = verity;
const { Provision } = verity.protocols.v0_7;
const { UpdateConfigs } = verity.protocols;
const verityUrl = 'https://vas.pps.evernym.com';
const logoUrl = 'https://i.pinimg.com/originals/e7/fe/0c/e7fe0cc68ab049b50e45cb002952a6e6.jpg';
const issuerToken = '{"sponseeId": "Evernym-customer", "sponsorId": "evernym-demo-sponsor", "nonce": "3dYd7l4a5AnA0TFbKVE8eq0aQPlPa85l", "timestamp": "2020-07-23T14:19:38.225623", "sig": "ms64mlobnIQO318yYlLzXhzeLubSdTayhMaHdBnJQcEehRmI5lmN7M7y1IMne6UWweLY0sxgKxOF3VJD0XIkAA==", "sponsorVerKey": "BCHo16QAdnZtPxaEjGBPQEiohxF62LR3qVwce298g7Jf"}';
const verifierToken = '{"sponseeId": "Evernym-customer", "sponsorId": "evernym-demo-sponsor", "nonce": "bx9YgflGgkYQ0yiisq5trw93exmqQtAL", "timestamp": "2020-07-23T14:19:38.225623", "sig": "5Zqf8uwua94cAoCUrVSyk1O2OqfCtsAeo51I8zPsMgC93aiOAqN0JAeRKqW/5JykkXBnRVOrY7UDMnXUofGGBg==", "sponsorVerKey": "BCHo16QAdnZtPxaEjGBPQEiohxF62LR3qVwce298g7Jf"}';
const holderToken = '{"sponseeId": "Evernym-customer", "sponsorId": "evernym-demo-sponsor", "nonce": "tbCP2aqkUVJhXnRigSpU9KG4m0VzIik6", "timestamp": "2020-07-23T14:19:38.225623", "sig": "mf55+5mqqXS/6UlEF4TwjPrebYtnn5IBz0040GTpowGSqa2Y5MHBxdQPym21s/6prSV1DhInLDz7lKwM6qLcAw==", "sponsorVerKey": "BCHo16QAdnZtPxaEjGBPQEiohxF62LR3qVwce298g7Jf"}';


async function provisionAgent(institutionName, walletName, walletKey, token) {
    const context = await Context.create(walletName, walletKey, verityUrl, '');
    const threadId = null;
    const provision = new Provision(threadId, token);
    const newContext = await provision.provision(context);

    const updateConfigs = new sdk.protocols.UpdateConfigs(institutionName, logoUrl)
    await updateConfigs.update(context)

    return newContext;
}

async function main() {
    const issuer = await provisionAgent('issuerWallet', 'issuerKey', issuerToken);
    const verifier = await provisionAgent('verifierWallet', 'verifierKey', verifierToken);
    const holder = await provisionAgent('holderWallet', 'holderKey', holderToken);

    console.log(`issuer: ${JSON.stringify(issuer)}`);
    console.log(`verifier: ${JSON.stringify(verifier)}`);
    console.log(`holder: ${JSON.stringify(holder)}`);

    // context.endpointUrl
}

main().then(console.log('Done'));