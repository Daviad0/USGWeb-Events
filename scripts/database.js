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
}

const getEndpoints = {
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
    profiles: (usePositions) => {
        if(usePositions){
            console.log("Using positions: ", usePositions);
            return new Promise((resolve, reject) => {
                db.all('SELECT * FROM usg_profiles WHERE LOWER(position) IN (?)', [usePositions.join(",")],  (error, results) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(results);
                });
            });
        }

        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM usg_profiles', [], (error, results) => {
                if (error) {
                    reject(error);
                }

                resolve(results);
            });
        });
    },
    profile: (username) => {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM usg_profiles WHERE username = ?', [username], (error, results) => {
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
    profile: (username, name, position, status, data) => {

        
        return new Promise(async (resolve, reject) => {
            // get the current profile

            let results = await getEndpoints.profile(username);
            if(results.length > 0){
                name = name || results[0].name;
                position = position || results[0].position;
                status = status || results[0].status;
                data = data || results[0].data;
                last_updated = new Date();

                db.run('UPDATE usg_profiles SET name = ?, position = ?, status = ?, data = ?, last_updated = ? WHERE username = ?', [name, position, status, data, last_updated, username], (error) => {
                    if (error) {
                        reject(error);
                    }
                    resolve({ message: 'Profile updated successfully' });
                });

            }else{
                db.run('INSERT INTO usg_profiles (username, name, position, status, data, last_updated) VALUES (?, ?, ?, ?, ?, ?)', [username, name, position, status, data, new Date()], (error) => {
                    if (error) {
                        reject(error);
                    }
                    resolve({ message: 'Profile created successfully' });
                });
            }
        });
    },
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
    profile: (username) => {
        return new Promise((resolve, reject) => {
            db.run('DELETE FROM usg_profiles WHERE username = ?', [username], (error) => {
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
    }
}

module.exports = {
    db: db,
    initializeTables: initializeTables,
    getEndpoints: getEndpoints,
    postEndpoints: postEndpoints,
    removeEndpoints: removeEndpoints
}