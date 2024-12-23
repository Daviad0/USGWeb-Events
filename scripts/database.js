const mysql = require('mysql2');
const dotenv = require('dotenv');
dotenv.config();

var connection = {
    query: (query, callback) => {
        console.log('Query: ' + query);
        callback(null, [], []);
    },
    connect: (callback) => {
        console.log('Connected to database');
    }
};

function connect() {

    connection = mysql.createConnection({
        host: 'usgwp-internal-mtu-6ca0.i.aivencloud.com',
        user: 'avnadmin',
        password: process.env.DB_PASSWORD,
        database: 'defaultdb',
        port: 19150
        
    });

    connection.connect((error) => {
        if (error) {
            console.log('Error connecting to database: ' + error.stack);
            return;
        }

        console.log('Connected to database as id ' + connection.threadId);
    });
}   

const getEndpoints = {
    members: () => {
        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM usg_members', (error, results, fields) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    profiles: (usePositions) => {
        if(usePositions){
            return new Promise((resolve, reject) => {
                connection.query('SELECT * FROM usg_profiles WHERE position IN (?)', [usePositions.join("','")],  (error, results, fields) => {
                    if (error) {
                        reject(error);
                    }
    
                    resolve(results);
                });
            });
        }

        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM usg_profiles', (error, results, fields) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    profile: (username) => {
        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM usg_profiles WHERE username = ?', [username], (error, results, fields) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    }
};

const postEndpoints = {
    // adds or updates a member in the database
    member: (username, access) => {
        return new Promise((resolve, reject) => {
            connection.query('INSERT INTO usg_members (username, access, updated) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE access = ?, updated = ?', [username, access, new Date(), access, new Date()], (error, results, fields) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    }
}

const removeEndpoints = {
    member: (username) => {
        return new Promise((resolve, reject) => {
            connection.query('DELETE FROM usg_members WHERE username = ?', [username], (error, results, fields) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    }
}

module.exports = {
    connect: connect,
    getEndpoints: getEndpoints,
    postEndpoints: postEndpoints,
    removeEndpoints: removeEndpoints
}