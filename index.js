const axios = require('axios');
const DynamoDB = require('aws-sdk/clients/dynamodb');
const DynamoDBLocal = require("dynamodb-local");

/*
  These functions and config ordinarily would be inside a database singleton
  
  For the purposes of this example they are inline
*/

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
/* End Database Helpers */

/*
  This would ordinarily be inside a definitions file
  
  For the purposes of this example it is inline
 */
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
/* End Definitions */

/* Begin Application */
console.log('Starting Application');

// Start DynamoDB
DynamoDBLocal.launch(8000, `${process.cwd()}/database`, ['-sharedDb']).then(() => {
  
  // DynamoDB has started
  console.log("DynamoDB listening on 8000");
  console.log('Retrieving Data');
  
  /*
    As we do not need the result of the table check until AFTER the axios result has been
    retrieved we may begin the task and handle the outcome later
   */
  let tableExistsPromise = ensureTableExists(dataTable);
  
  // Retrieve our data with Axios
  axios.get("https://google.com")
  .then( result => {
    
    // Create a handler for the table check promise
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
        // Insert the data into DynamoDB
        documentClient.put(putItemInput, (err, data) => {
          console.log("Data was inserted");
          
          // Explicitly tell the application we are done
          console.log("done");
          process.exit(0);
        });
      });
  });
});