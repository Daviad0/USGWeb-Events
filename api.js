const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('./scripts/database');

/**
 * POST - /api/member
 *  - username: string
 *  - access: string
 * 
 * Posts a single member adjustment to the database
 * Allows a username to be posted for one of the 3 statuses:
 *  - none: Removed from DB
 *  - user: Added to DB
 *  - admin: Added to DB
 */
router.post('/member', async (req, res) => {
    let username = req.body.username;
    let access = req.body.access;

    console.log(username, access);

    if(['none', 'user', 'admin'].indexOf(access) == -1){
        res.status(400).send('Invalid access level');
        return;
    }
    
    // remove the member from the database if none
    if(access == 'none') {
        try {
            await db.removeEndpoints.member(username, access);
            res.status(200).send('Success');
        } catch (error) {
            res.status(500).send('Error: ' + error);
        }
        return;
    }



    // add the member to the database or update the access
    try {
        await db.postEndpoints.member(username, access);
        res.status(200).send('Success');
    } catch (error) {
        res.status(500).send('Error: ' + error);
    }
});

/**
 * POST - /api/navigation
 *  - navigation: string (JSON)
 */

router.post('/navigation', async (req, res) => {
    let navigation = req.body.navigation;

    // set the nav_data.json file to the new navigation
    fs.writeFileSync(__dirname + '/nav_data.json', navigation);

    res.status(200).send('Success');
});

module.exports = router;