const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('./scripts/database');
const fileUpload = require('express-fileupload');

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

    if(['none', 'member', 'admin'].indexOf(access) == -1){
        res.status(400).send('Invalid access level');
        return;
    }
    
    // remove the member from the database if none
    if(access == 'guest') {
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
 * GET - /api/profile
 *  - positions: string, CSV
 * 
 * Gets the profile information for a given position
 */

router.get('/profile', async (req, res) => {
    let position = req.query.positions;
    if(!position){
        position = null;
    }else{
        position = position.split(',');
    }

    let allProfiles = await db.getEndpoints.profiles();
    console.log("All profiles: ", allProfiles);

    try {
        let profile = await db.getEndpoints.profiles(position);
        res.status(200).send(profile);
    } catch (error) {
        res.status(500).send('Error: ' + error);
    }
});

/**
 * POST - /api/profile
 *  - username: string
 *  - position: string
 *  - name: string
 *  - status: string
 *  - data: string (JSON)
 *  - delete: boolean
 * 
 * Either creates or updates a profile in the database given the username passed into the system
 */

router.post('/profile', async (req, res) => {
    let username = req.body.username;
    let name = req.body.name;
    let position = req.body.position;
    let status = req.body.status;
    let data = req.body.data;
    let deleteProfile = req.body.delete;

    console.log(username, name, position, status, data, deleteProfile);

    if(deleteProfile){
        try {
            await db.removeEndpoints.profile(username);
            res.status(200).send('Success');
        } catch (error) {
            res.status(500).send('Error: ' + error);
        }
        return;
    }
    try {
        await db.postEndpoints.profile(username, name, position, status, data);
        res.status(200).send('Success');
    } catch (error) {
        res.status(500).send('Error: ' + error);
    }
});

/**
 * POST - /api/profile/image
 * - image: file
 */

router.post('/profile/image', fileUpload(), async (req, res) => {
    if(!req.files || !req.files.image) {
        return res.status(400).send('No image uploaded');
    }

    let image = req.files.image;
    let name = req.body.name;
    if(!name) {
        name = image.name;
    }

    // replace any invalid characters in the filename
    name = name.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // add to uploaded directory
    let uploadPath = __dirname + '/uploaded/' + name;

    image.mv(uploadPath, (err) => {
        if(err) {
            return res.status(500).send('Error: ' + err);
        }
        res.status(200).send('/uploaded/' + name);
    });

    // send back the path to the image
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