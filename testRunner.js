//testRunner.js
const { Api, JsonRpc } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig'); 
const fetch = require('node-fetch');
const { assert } = require('chai');
const fs = require('fs');
const path = require('path');

const privateKey = '5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3';
const signatureProvider = new JsSignatureProvider([privateKey]);
const rpc = new JsonRpc('http://localhost:8888', { fetch });
const api = new Api({ rpc, signatureProvider });


const testDir = __dirname + '/tests/';
const testFilesData = fs.readdirSync(testDir)
                    .filter(file => path.extname(file) === '.json')
                    .map(file => ({
                        name: path.basename(file, '.json'),
                        data: require(path.join(testDir, file))
                    }));

async function sendTransaction(account, actionName, actionData, actor, permission) {
    return await api.transact({
        actions: [{
            account: account,
            name: actionName,
            authorization: [{
                actor: actor,
                permission: permission,
            }],
            data: actionData,
        }]
    }, {
        useLastIrreversible: true,
        expireSeconds: 30,
    });
}

function logErrorToFile(errorDesc, data) {
    // Read the current content of the errors.json file
    let errors = [];
    if (fs.existsSync('errors.json')) {
        const currentContent = fs.readFileSync('errors.json', 'utf8');
        try {
            errors = JSON.parse(currentContent);
        } catch (e) {
            console.error('Error parsing errors.json:', e);
        }
    }

    // Push the new error with a timestamp to the array
    errors.push({
        timestamp: new Date().toISOString(),
        error_desc: errorDesc,
        ...data
    });

    // Write the updated array back to the errors.json file
    fs.writeFileSync('errors.json', JSON.stringify(errors, null, 2));
}


describe('nft.scribe testing...', () => {

    beforeEach(done => {
        setTimeout(done, 100);
    });

    testFilesData.forEach(({ name, data }) => {
        describe(`${name} test:`, () => {
            data.forEach(test => {
                it(test.description, async () => {
                    try {
                        if (test.function === 'sendTransaction') {
                            const result = await sendTransaction(...test.params);
                            if (test.shouldFail) {
                                logErrorToFile('Transaction should have failed but it succeeded', { result });
                                assert.fail('Transaction should have failed but it succeeded');
                            } else {
                                assert.exists(result.transaction_id, 'Transaction failed but it should have succeeded');
                            }
                        } else if (test.function === 'get_table_rows') {
                            const tableRows = await rpc.get_table_rows(test.params);
                            assert.exists(tableRows.rows, 'Table is empty');
                            const firstRow = tableRows.rows[0];
                            for (const key in test.expectedValues) {

                                if (firstRow && "oracle" in firstRow) {
                                    if(firstRow.oracle[key] !== test.expectedValues[key]) {
                                        logErrorToFile("tableRows provided...", tableRows);
                                        logErrorToFile(`Error struct_oracle: ${key} does not match A`, firstRow.oracle[key]);
                                    }
                                    assert.equal(firstRow.oracle[key], test.expectedValues[key], `${key} does not match A`);
                                } else if (firstRow && "t" in firstRow) {
                                    if(firstRow.t[key] !== test.expectedValues[key]) {
                                        logErrorToFile("tableRows provided...", tableRows);
                                        logErrorToFile(`Error struct_token: ${key} does not match B`, firstRow.t[key]);
                                    }
                                    assert.equal(firstRow.t[key], test.expectedValues[key], `${key} does not match B`);
                                } else if ((firstRow && "contracts" in firstRow) && (key == "contracts")) {
                                    var strContractsFirstRow = JSON.stringify(firstRow.contracts);
                                    var strContractsExpected = JSON.stringify(test.expectedValues[key]);

                                    if(strContractsFirstRow !== strContractsExpected) {
                                        logErrorToFile("tableRows provided...", tableRows);
                                        logErrorToFile("Error contracts: " + strContractsExpected + " does not match C " + strContractsFirstRow, []);
                                    }

                                    assert.equal(strContractsFirstRow, strContractsExpected, `${key} array does not match C`);
                                } else if (firstRow && key === "tokens" && "tokens" in firstRow) {
                                    var found = false;
                                
                                    for(var i=0; i < firstRow.tokens.length; i++) {
                                        if(firstRow.tokens[i].id == test.expectedValues[key]) { found = true; }
                                    }
                                
                                    if(!found) {
                                        logErrorToFile("tableRows provided...", tableRows);
                                        logErrorToFile("Error contracts: " + strtokensExpected + " does not match D" + strTokensFirstRow, []);
                                    }
                                
                                    assert.isTrue(found, `${key} did not have matching id value D`);
                                } else {
                                    if (firstRow[key] !== test.expectedValues[key]) {
                                        logErrorToFile(`${key} does not match E`, firstRow[key]);
                                    }
                                    assert.equal(firstRow[key], test.expectedValues[key], `${key} does not match E`);
                                }
                            }
                        }
                    } catch (error) {
                        if (!test.shouldFail) {
                            //logErrorToFile(error.message, {});
                            throw error; // If the test is not supposed to fail, throw the error
                        }
                        // If the test is supposed to fail, and it does, then it's a success
                    }
                });
            });
        });
    });
});
