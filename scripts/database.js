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
    },
    post: (id) => {
        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM usg_posts WHERE id = ?', [id], (error, results, fields) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    posts: () => {
        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM usg_posts', (error, results, fields) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    posts: (number) => {
        // order by updated
        return new Promise((resolve, reject) => {
            connection.query('SELECT * FROM usg_posts ORDER BY updated DESC LIMIT ?', [number], (error, results, fields) => {
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
    },
    profile: (username, position, contact, photo, name, description, status) => {

        
        return new Promise(async (resolve, reject) => {
            // get the current profile

            let results = await getEndpoints.profile(username);
            if(results.length > 0){
                position = position || results[0].position;
                contact = contact || results[0].contact;
                photo = photo || results[0].photo;
                name = name || results[0].name;
                description = description || results[0].description;
                status = status || results[0].status;

                connection.query('UPDATE usg_profiles SET position = ?, contact = ?, photo = ?, name = ?, description = ?, updated = ?, status = ? WHERE username = ?', [position, contact, photo, name, description, new Date(), status, username], (error, results, fields) => {
                    if (error) {
                        reject(error);
                    }
    
                    resolve(results);
                });

            }else{
                connection.query('INSERT INTO usg_profiles (username, contact, updated) VALUES (?, ?, ?)', [username, contact, new Date()], (error, results, fields) => {
                    if (error) {
                        reject(error);
                    }
    
                    resolve(results);
                });
            }
        });
    },
    post: (id, title, author, html_content, draft) => {
        return new Promise(async (resolve, reject) => {
            // get the current post

            let results = await getEndpoints.post(id);

            if(results.length > 0){
                title = title || results[0].title;
                author = author || results[0].author;
                html_content = html_content || results[0].html_content;
                draft = draft || results[0].draft;

                connection.query('UPDATE usg_posts SET title = ?, author = ?, html_content = ?, draft = ?, updated = ? WHERE id = ?', [title, author, html_content, draft, new Date(), id], (error, results, fields) => {
                    if (error) {
                        reject(error);
                    }
    
                    resolve(results);
                });
            }else{
                connection.query('INSERT INTO usg_posts (title, author, html_content, draft, updated) VALUES (?, ?, ?, ?, ?)', [title, author, html_content, draft, new Date()], (error, results, fields) => {
                    if (error) {
                        reject(error);
                    }
    
                    resolve(results);
                });
            }
            
            
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
    },
    profile: (username) => {
        return new Promise((resolve, reject) => {
            connection.query('DELETE FROM usg_profiles WHERE username = ?', [username], (error, results, fields) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    post: (id) => {
        return new Promise((resolve, reject) => {
            connection.query('DELETE FROM usg_posts WHERE id = ?', [id], (error, results, fields) => {
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