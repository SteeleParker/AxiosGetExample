const axios = require('axios');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const DynamoDBLocal = require("dynamodb-local");

/* These functions would go into your database singleton alongside your DDB Config et el. */
let ddbConfig = {
  endpoint: 'http://localhost:8000/',
  apiVersion: '2012-08-10',
  region: 'ap-southeast-2',
  accessKeyId: 'LOCAL-ENV',
  secretAccessKey: 'LOCAL-ENV'
};

let dynamoDB = new DynamoDB(ddbConfig);
let documentClient = new DynamoDB.DocumentClient(ddbConfig);

async function listTables() {
  return new Promise((resolve, reject) => {
    dynamoDB.listTables({}, (err, data) => {
      if (err) {
        console.log('Error', err.code);
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

async function createTable(definition) {
  return new Promise((resolve, reject) => {
    dynamoDB.createTable(definition, (err, data) => {
      if (err) {
        console.log('Error', err.code);
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

async function ensureTableExists(verificationRecord) {
  const tableList = await listTables();
  
  return new Promise((resolve, reject) => {
    try {
      if (tableList.TableNames && tableList.TableNames.length) {
        const tableRecord = tableList.TableNames.find(
          (item) => item === verificationRecord.definition.TableName
        );
        
        if (tableRecord) {
          return resolve();
        }
      }
      
      createTable(verificationRecord.definition)
      .then(() => {
        return resolve();
      })
      .catch(err => {
        return reject(err);
      });
    } catch (e) {
      reject(e);
    }
  });
}


/* This should be inside a definitions file somewhere but for now we will write it inline */
const dataTable = {
  definition: {
    TableName: 'PROFIT_HISTORY',
    KeySchema: [
      {
        AttributeName: 'someKey',
        KeyType: 'HASH'
      }
    ],
    AttributeDefinitions: [
      {
        AttributeName: 'someKey',
        AttributeType: 'S'
      }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  }
};

/* Begin the actual application */
console.log('Starting Application');
DynamoDBLocal.launch(8000, `${process.cwd()}/database`, ['-sharedDb']).then(() => {
  console.log("DynamoDB listening on 8000");
  
  console.log('Retrieving Data');
  
  /*
    As we do not need dynamoDB tables until AFTER the axios result has been retrieved
    We can begin the task of ensuring the table exists now and handle the outcome later
   */
  
  let tableExistsPromise = ensureTableExists(dataTable);
  
  axios.get("https://google.com")
  .then( result => {
    
    tableExistsPromise
      .then( result => {
        console.log("Table Exists!");
        
        let putItemInput = {
          Item: {
            someKey : "test",
            someData : "somethingElse"
          },
          TableName: dataTable.definition.tableName
        };
        
        console.log("Inserting Data");
        documentClient.put(putItemInput, (err, data) => {
          console.log("Data was inserted");
          
          console.log("done");
          
          process.exit(0);
        });
      });
  });
});