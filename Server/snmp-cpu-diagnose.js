import snmp from 'net-snmp';

const testIP = process.argv[2] || '192.168.100.114';
const community = process.argv[3] || 'public';

console.log(`🔍 Diagnosing SNMP CPU OIDs for: ${testIP}`);
console.log(`Community: ${community}\n`);

const session = snmp.createSession(testIP, community);

const oids = [
    '1.3.6.1.2.1.25.3.3.1.2', // hrProcessorLoad
];

function doneCb(error) {
    if (error)
        console.error(error.toString());
    session.close();
}

function feedCb(varbinds) {
    for (var i = 0; i < varbinds.length; i++) {
        if (snmp.isVarbindError(varbinds[i]))
            console.error(snmp.varbindError(varbinds[i]));
        else
            console.log(varbinds[i].oid + " = " + varbinds[i].value);
    }
}

session.subtree(oids[0], 20, feedCb, doneCb);
