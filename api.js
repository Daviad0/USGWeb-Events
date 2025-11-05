const express = require('express');
const router = express.Router();
const fs = require('fs');
const db = require('./scripts/database');
const fileUpload = require('express-fileupload');

// expecting can be 'admin', 'member', 'logged_out' or 'any'
function checkAuthentication(sessionInfo, expecting) {
    if (!sessionInfo || !sessionInfo.access) {
        return expecting === 'logged_out';
    }

    switch (expecting) {
        case 'admin':
            return sessionInfo.access === 'admin';
        case 'member':
            return sessionInfo.access === 'member' || sessionInfo.access === 'admin';
        case 'any':
            return true;
        default:
            return false;
    }
}

router.get("/authorized", async(req, res) => {
    let access = req.session.user_info.access;
    if(checkAuthentication(req.session.user_info, 'admin')){
        res.status(200).send('User is authorized');
    } else {
        res.status(403).send('User is not authorized');
    }
})

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

    if(['guest', 'member', 'admin'].indexOf(access) == -1){
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
 * GET - /api/config
 * - key: string
 * 
 * Gets the configuration for a given key
 */
router.get('/config', async (req, res) => {
   let key = req.query.key;
   if (!key) {
    return res.status(400).send('Missing key parameter');
   }

   try {
       let config = await db.getEndpoints.config(key);
       res.status(200).send(config);
   } catch (error) {
       res.status(500).send('Error: ' + error);
   }
});

/**
 * POST - /api/config
 * - key: string
 * - name: string
 * - description: string
 * - value: string
 * 
 * Posts a configuration to the database
 * If the key already exists, it will update the value
 * Only key and value are required, name and description are optional
 */
router.post('/config', async (req, res) => {
    let key = req.body.key;
    let name = req.body.name;
    let description = req.body.description;
    let value = req.body.value;

    if (!key || !value) {
        return res.status(400).send('Missing parameters');
    }

    try {
        await db.postEndpoints.config(key, name, description, value);
        res.status(200).send('Success');
    } catch (error) {
        res.status(500).send('Error: ' + error);
    }

});

/**
 * GET - /api/election
 * - url: string
 * 
 * Gets the election information for a given URL
 */
router.get('/election', async (req, res) => {
    let url = req.query.url;
    if (!url) {
        return res.status(400).send('Missing URL parameter');
    }

    try {
        let election = await db.getEndpoints.election(url);
        res.status(200).send(election);
    } catch (error) {
        res.status(500).send('Error: ' + error);
    }
});

/**
 * POST - /api/election
 * - url: string
 * - title: string
 * - description: string
 * - delete: boolean (optional)
 * 
 * Posts an election to the database
 * If the URL already exists, it will update the title and description
 */
router.post('/election', async (req, res) => {
    let url = req.body.url;
    let title = req.body.title;
    let description = req.body.description;

    if (!url || !title) {
        return res.status(400).send('Missing parameters');
    }

    try {
        await db.postEndpoints.election(url, title, description);
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
 * Should only be used for drafts
 */

router.get('/profile', async (req, res) => {
    let position = req.query.positions;
    if(!position){
        position = null;
    }else{
        position = position.split(',');
    }

    let allProfiles = await db.getEndpoints.profiles([], false);
    console.log("All profiles: ", allProfiles);

    try {
        let profile = await db.getEndpoints.profiles(position, false);
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

    let sessionInfo = req.session.user_info;
    // can we post directly to the real profiles?
    let canPostDirectlyToReal = checkAuthentication(sessionInfo, 'admin');

    // get the profile beforehand, see if we are changing the status
    // if we aren't, check if this is a NON-ADMIN user
    // then, make the status awaiting changes so it can be reviewed
    let profile = await db.getEndpoints.profile(username);
    if(
        profile &&
        profile.status &&
        profile.status == status &&
        !canPostDirectlyToReal
    ){
        status = "review";
    }else if((!profile || !profile.status) && !canPostDirectlyToReal){ // if not already a profile or status is not set, set it to review
        status = "review";
    }

    console.log(username, name, position, status, data, deleteProfile);

    // set the status if set
    if(status){
        profile.status = status;
    }

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
        // we are working with a draft
        // await db.postEndpoints.profile(username, name, position, status, data, true);
        await db.postEndpoints.profile(username, name, position, status, data);
        if(canPostDirectlyToReal && (profile.status == "ok" || profile.status == "hide")){
            // post to the real table as well!
            // copy over the entire profile from draft (username) to final (username$final)
            await db.postEndpoints.moveProfileToFinal(username);
        }
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

/**
 * POST - /api/break-bus
 *  - breakBusInfo: string (JSON)
 */

router.post('/break-bus', async (req, res) => {
    let breakBusInfo = req.body.breakBusInfo;

    // set the break-bus-info.json file to the new break bus info
    fs.writeFileSync(__dirname + '/testing/break-bus-info.json', breakBusInfo);

    res.status(200).send('Success');
});

module.exports = router;