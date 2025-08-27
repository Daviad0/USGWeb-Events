// const mysql = require('mysql2');
const sqlite3 = require('sqlite3');

// get sqlite3 db from file
const db = new sqlite3.Database(__dirname + '/database.db', (err) => {
    if (err) {
        console.error('Error opening database ' + err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

const dotenv = require('dotenv');
dotenv.config();

// var connection = {
//     query: (query, callback) => {
//         console.log('Query: ' + query);
//         callback(null, [], []);
//     },
//     connect: (callback) => {
//         console.log('Connected to database');
//     }
// };

// to only be ran when the database is not initialized yet
function initializeTables() {
    // create configuration table
    // includes key, name, description, value, last_updated (datetime)
    db.run(`CREATE TABLE IF NOT EXISTS usg_configuration (
        key TEXT PRIMARY KEY,
        name TEXT,
        description TEXT,
        value TEXT,
        last_updated DATETIME
    )`, (err) => {
        if (err) {
            console.error('Error creating usg_configuration table: ' + err.message);
        } else {
            console.log('usg_configuration table created or already exists.');
        }
    });

    // create access table
    // includes username, access, last_updated
    // access can be either 'admin', 'member', or 'guest'
    db.run(`CREATE TABLE IF NOT EXISTS usg_members (
        username TEXT PRIMARY KEY,
        access TEXT,
        last_updated DATETIME
    )`, (err) => {
        if (err) {
            console.error('Error creating usg_members table: ' + err.message);
        } else {
            console.log('usg_members table created or already exists.');
        }
    });

    // create profiles table
    // includes username, name, position, status, data, last_updated
    db.run(`CREATE TABLE IF NOT EXISTS usg_profiles (
        username TEXT PRIMARY KEY,
        name TEXT,
        position TEXT,
        status TEXT,
        data TEXT,
        last_updated DATETIME
    )`, (err) => {
        if (err) {
            console.error('Error creating usg_profiles table: ' + err.message);
        } else {
            console.log('usg_profiles table created or already exists.');
        }
    });

    // create draft profiles table
    // includes username, name, position, status, data, last_updated
    // duplicates the usg_profiles table but is used for draft profiles
    db.run(`CREATE TABLE IF NOT EXISTS usg_profiles_draft (
        username TEXT PRIMARY KEY,
        name TEXT,
        position TEXT,
        status TEXT,
        data TEXT,
        last_updated DATETIME
    )`, (err) => {
        if (err) {
            console.error('Error creating usg_profiles_draft table: ' + err.message);
        } else {
            console.log('usg_profiles_draft table created or already exists.');
        }
    });

    // create elections table
    // includes url, title, description, last_updated
    db.run(`CREATE TABLE IF NOT EXISTS usg_elections (
        url TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        last_updated DATETIME
    )`, (err) => {
        if (err) {
            console.error('Error creating usg_elections table: ' + err.message);
        } else {
            console.log('usg_elections table created or already exists.');
        }
    });

    
    

    // initialize the configuration table with default values
    // key: 'permanent_accounts'
    db.run(`INSERT OR IGNORE INTO usg_configuration (key, name, description, value, last_updated) VALUES (?, ?, ?, ?, ?)`, 
        ['permanent_accounts', 
            'Permanent Accounts', 
            'A list of accounts that are always considered admins', 
            'usg,usg-president,usg-vice-president,usg-secretary,usg-treasurer',
            new Date()], 
        (err) => {
            if (err) {
                console.error('Error inserting into usg_configuration table: ' + err.message);
            } else {
                console.log('Default configuration inserted into usg_configuration table.');
            }
        });
}

const getEndpoints = {
    config: (key) => { // actually returns a single configuration value or null
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM usg_configuration WHERE key = ?', [key], (error, results) => {
                if (error) {
                    reject(error);
                }

                if(!results) {
                    resolve(null);
                }
                resolve(results);
            });
        });
    },
    members: () => {
        return new Promise((resolve, reject) => {
            // where access is 'member' or 'admin'
            // let allowedRoles = ['member', 'admin']
            db.all('SELECT * FROM usg_members', [], (error, results) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    member: (username) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM usg_members WHERE username = ?', [username], (error, results) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    profiles: (usePositions, draft) => {
        let table = draft ? 'usg_profiles_draft' : 'usg_profiles'; 
        if(usePositions && usePositions.length > 0){
            console.log("Using positions: ", usePositions);
            return new Promise((resolve, reject) => {
                db.all(`SELECT * FROM ${table} WHERE LOWER(position) IN (?)`, [usePositions.join(",")],  (error, results) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(results);
                });
            });
        }

        return new Promise((resolve, reject) => {
            db.all(`SELECT * FROM ${table}`, [], (error, results) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    profile: (username, draft) => {
        return new Promise((resolve, reject) => {
            let table = 'usg_profiles';
            db.all(`SELECT * FROM ${table} WHERE username = ?`, [username], (error, results) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    elections: () => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM usg_elections', [], (error, results) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    election: (url) => {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM usg_elections WHERE url = ?', [url], (error, results) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    }
    // post: (id) => {
    //     return new Promise((resolve, reject) => {
    //         db.all('SELECT * FROM usg_posts WHERE id = ?', [id], (error, results) => {
    //             if (error) {
    //                 reject(error);
    //             }

    //             resolve(results);
    //         });
    //     });
    // },
    // posts: () => {
    //     return new Promise((resolve, reject) => {
    //         connection.query('SELECT * FROM usg_posts', (error, results, fields) => {
    //             if (error) {
    //                 reject(error);
    //             }

    //             resolve(results);
    //         });
    //     });
    // },
    // posts: (number) => {
    //     // order by updated
    //     return new Promise((resolve, reject) => {
    //         connection.query('SELECT * FROM usg_posts ORDER BY updated DESC LIMIT ?', [number], (error, results, fields) => {
    //             if (error) {
    //                 reject(error);
    //             }

    //             resolve(results);
    //         });
    //     });
    // }
};

const postEndpoints = {
    // adds or updates a member in the database
    member: (username, access) => {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO usg_members (username, access, last_updated) VALUES (?, ?, ?) ON CONFLICT(username) DO UPDATE SET access = ?, last_updated = ?', [username, access, new Date(), access, new Date()], (error) => {
                if (error) {
                    console.error('Error inserting or updating member:', error);
                    reject(error);
                }

                resolve({ message: 'Member added or updated successfully' });
            });
        });
    },
    profile: (username, name, position, status, data, draft) => {
        let table = 'usg_profiles';
        
        return new Promise(async (resolve, reject) => {
            // get the current profile

            let results = await getEndpoints.profile(username);
            if(results.length > 0){
                name = name || results[0].name;
                position = position || results[0].position;
                status = status || results[0].status;
                data = data || results[0].data;
                last_updated = new Date();

                db.run(`UPDATE ${table} SET name = ?, position = ?, status = ?, data = ?, last_updated = ? WHERE username = ?`, [name, position, status, data, last_updated, username], (error) => {
                    if (error) {
                        reject(error);
                    }
                    resolve({ message: 'Profile updated successfully' });
                });

            }else{
                db.run(`INSERT INTO ${table} (username, name, position, status, data, last_updated) VALUES (?, ?, ?, ?, ?, ?)`, [username, name, position, status, data, new Date()], (error) => {
                    if (error) {
                        reject(error);
                    }
                    resolve({ message: 'Profile created successfully' });
                });
            }
        });
    },
    moveProfileToFinal: (username) => {
        return new Promise(async (resolve, reject) => {
            // get the current profile

            let results = await getEndpoints.profile(username);
            if(results.length > 0){
                let name = results[0].name;
                let position = results[0].position;
                let status = results[0].status;
                let data = results[0].data;
                let last_updated = new Date();
                let new_username = `${username}\$final`;

                // insert or update the final profile into usg_profiles
                db.run(`INSERT INTO usg_profiles (username, name, position, status, data, last_updated) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(username) DO UPDATE SET name = ?, position = ?, status = ?, data = ?, last_updated = ?`, 
                    [new_username, name, position, status, data, last_updated, name, position, status, data, last_updated], (error) => {
                    if (error) {
                        reject(error);
                    }
                    resolve({ message: 'Profile moved to final successfully' });
                });

            }else{
                db.run(`INSERT INTO ${table} (username, name, position, status, data, last_updated) VALUES (?, ?, ?, ?, ?, ?)`, [username, name, position, status, data, new Date()], (error) => {
                    if (error) {
                        reject(error);
                    }
                    resolve({ message: 'Profile created successfully' });
                });
            }
        });
    },
    election: (url, title, description) => {
        return new Promise((resolve, reject) => {
            // insert or update the election
            // if the url already exists, update the title and description
            // otherwise, insert a new election
            db.run(`INSERT INTO usg_elections (url, title, description) VALUES (?, ?, ?) ON CONFLICT(url) DO UPDATE SET title = ?, description = ?`, [url, title, description, title, description], (error) => {
                if (error) {
                    reject(error);
                }
                resolve({ message: 'Election created successfully' });
            });
        });
    },
    config: (key, name, description, value) => {
        return new Promise((resolve, reject) => {
            // insert or update the configuration
            // if the key already exists, update the name, description, value, and last_updated
            // otherwise, insert a new configuration
            db.run(`INSERT INTO usg_configuration (key, name, description, value, last_updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET name = ?, description = ?, value = ?, last_updated = ?`, 
                [key, name, description, value, new Date(), name, description, value, new Date()], 
                (error) => {
                if (error) {
                    reject(error);
                }
                resolve({ message: 'Configuration updated successfully' });
            });
        });
    }

    // post: (id, title, author, html_content, draft) => {
    //     return new Promise(async (resolve, reject) => {
    //         // get the current post

    //         let results = await getEndpoints.post(id);

    //         if(results.length > 0){
    //             title = title || results[0].title;
    //             author = author || results[0].author;
    //             html_content = html_content || results[0].html_content;
    //             draft = draft || results[0].draft;

    //             connection.query('UPDATE usg_posts SET title = ?, author = ?, html_content = ?, draft = ?, updated = ? WHERE id = ?', [title, author, html_content, draft, new Date(), id], (error, results, fields) => {
    //                 if (error) {
    //                     reject(error);
    //                 }
    
    //                 resolve(results);
    //             });
    //         }else{
    //             connection.query('INSERT INTO usg_posts (title, author, html_content, draft, updated) VALUES (?, ?, ?, ?, ?)', [title, author, html_content, draft, new Date()], (error, results, fields) => {
    //                 if (error) {
    //                     reject(error);
    //                 }
    
    //                 resolve(results);
    //             });
    //         }
            
            
    //     });
    // }
}

const removeEndpoints = {
    member: (username) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM usg_members WHERE username = ?', [username], (error) => {
                if (error) {
                    reject(error);
                }   
                resolve({ message: 'Member removed successfully' });
            });
        });
    },
    profile: (username, draft) => {
        let table = 'usg_profiles';
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM ${table} WHERE username = ? OR username = ?`, [username, `${username}\$final`], (error) => {
                if (error) {
                    reject(error);
                }

                resolve({ message: 'Profile removed successfully' });
            });
        });
    },
    post: (id) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM usg_posts WHERE id = ?', [id], (error) => {
                if (error) {
                    reject(error);
                }

                resolve({ message: 'Post removed successfully' });
            });
        });
    },
    election: (url) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM usg_elections WHERE url = ?', [url], (error) => {
                if (error) {
                    reject(error);
                }

                resolve({ message: 'Election removed successfully' });
            });
        });
    }
}

module.exports = {
    db: db,
    initializeTables: initializeTables,
    getEndpoints: getEndpoints,
    postEndpoints: postEndpoints,
    removeEndpoints: removeEndpoints
}