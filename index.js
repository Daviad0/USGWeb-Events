const express = require('express');
var CASAuthentication = require('cas-authentication');

const dotenv = require('dotenv');
dotenv.config();
const body_parser = require('body-parser');
const session = require('express-session');

const api = require('./api');
const db = require('./scripts/database');

const fs = require('fs');

const app = express();
const route = '/internal';



app.set('view engine', 'ejs');

/**
 * CAS Authentication Setup
 * From Michigan Technological University
 * 
 * Allowed members are defined in the database
 */

const cas = new CASAuthentication({
    cas_url         : 'https://sso.mtu.edu/cas',
    service_url     : 'https://usg.mtu.edu',
    cas_version     : '3.0',
    renew           : false,
    is_dev_mode     : false,
    dev_mode_user   : 'usg',
    dev_mode_info   : {
        displayName: "David Reeves",
        givenName: "David",
        sn: "Reeves",
        mail: "djreeves@mtu.edu",
        UID: "usg",
        memberOf: ["itss-ops-linux"],
    },
    session_name    : 'user',
    session_info    : 'user_info',
    destroy_session : false
});

// add public folder
app.use(route, express.static(__dirname + '/public'));
app.use(body_parser.json());

// add session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: {secure: false}
}));

// use api routes
app.use(`${route}/api`, api);

async function getAccessFromDb(username) {
    let permanent_accounts_string = await db.getEndpoints.config('permanent_accounts');
    let permanent_accounts = [];
    if(permanent_accounts_string != null && permanent_accounts_string.value){
        permanent_accounts = permanent_accounts_string.value.split(',');
    }

    let memberObj = null;
    if(permanent_accounts.includes(username)){
        // this user is a permanent admin
        memberObj = {
            username: username,
            access: 'admin',
        };
    }else{
        memberObj = await db.getEndpoints.member(username);
    }

    if(!memberObj){
        console.log("User not found in database, treat as guest");
        memberObj = {
            username: username,
            access: 'guest'
        };
    }

    return memberObj.access;
}

// Middleware to refresh session access
// read from the database each time
function refreshSession(req, res, next) {
    // refresh the session access
    let username = req.session.user;
    if(username != null && username != undefined && username != ''){
        getAccessFromDb(username).then(access => {
            req.session.user_info.access = access;
            next();
        });
    }
    else {
        // no user, just continue
        next();
    }
}

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

app.get(`${route}/session`, refreshSession, (req, res) => {
    // return an object with the session data
    let obj = {
        user: req.session.user,
        user_info: req.session.user_info
    };

    res.json(obj);
});

app.get(`${route}/authenticate`, refreshSession, cas.bounce, async (req, res) => {

    let username = req.session.user;
    console.log("Authenticated user:", username);

    // let permanent_accounts_string = await db.getEndpoints.config('permanent_accounts');
    // let permanent_accounts = [];
    // if(permanent_accounts_string != null && permanent_accounts_string.value){
    //     permanent_accounts = permanent_accounts_string.value.split(',');
    // }

    // let memberObj = null;
    // if(permanent_accounts.includes(username)){
    //     // this user is a permanent admin
    //     memberObj = {
    //         username: username,
    //         access: 'admin',
    //     };
    // }else{
    //     memberObj = await db.getEndpoints.member(username);
    // }

    // if(!memberObj){
    //     console.log("User not found in database, treat as guest");
    //     memberObj = {
    //         username: username,
    //         access: 'guest'
    //     };
    // }
    let access = await getAccessFromDb(username);

    let user_info = req.session.user_info;
    req.session.user_info = {
        access: access,
        ...user_info
    };

    // usg user is automatically an admin

    res.redirect('/');
});

app.get(`${route}/logout`, cas.logout, (req, res) => {
    res.redirect('/internal');
});

app.get(`/test`, (req, res) => {
    res.sendFile(__dirname + '/testing/member-profile.html');
});

app.get(`/nav_data.json`, refreshSession, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

app.get("/", (req, res) => {
    // redirect to /{route}
    res.redirect(`/${route}`);
})

// get any file
// specified by the path /uploaded/*
app.get(`${route}/uploaded/*`, refreshSession, (req, res) => {

    let useFileName = req.path.split('/').pop();

    let filePath = __dirname + "/uploaded/" + useFileName;

    console.log("Requested file:", filePath);

    // check if the file exists
    if(fs.existsSync(filePath)){
        res.sendFile(filePath);
    } else {
        res.status(404).send('File not found');
    }
});

app.get(`${route}/`, refreshSession, (req, res) => {

    console.log("SESSION", req.session);

    res.render(__dirname + '/views/index', {
        session: req.session
    });
});

app.get(`${route}/access`, refreshSession, async (req, res) => {

    let members = await db.getEndpoints.members();

    console.log(members);
    let permanent_accounts_string = await db.getEndpoints.config('permanent_accounts');
    let permanent_accounts = [];
    if(permanent_accounts_string != null && permanent_accounts_string.value){
        console.log("Permanent accounts string:", permanent_accounts_string.value);
        permanent_accounts = permanent_accounts_string.value.split(',');
    }

    res.render(__dirname + '/views/members', {
        session: req.session,
        members: members,
        permanent_accounts: permanent_accounts
    });
});

app.get(`${route}/navigation`, refreshSession, async (req, res) => {



    res.render(__dirname + '/views/navigation', {
        session: req.session
    });
});

app.get(`${route}/profile`, refreshSession, async (req, res) => {

    let user = req.session.user;
    if(req.query.profile){
        user = req.query.profile;
    }

    if(!user || user == ''){
        res.status(400).send('No user specified');
        return;
    }

    let profile = await db.getEndpoints.profile(user, true);
    if(profile.length == 0){
        // then check the non-draft profiles
        profile = await db.getEndpoints.profile(user, false);
        if(profile.length == 0){
            res.status(404).send('Profile not found');
            return;
        }

        await db.postEndpoints.profile(
            profile.username,
            profile.name,
            profile.position,
            profile.status,
            profile.data,
            true
        );  
        
    }

    profile = profile[0];

    res.render(__dirname + '/views/profile', {
        session: req.session,
        profile: profile
    });
});

app.get(`${route}/profiles`, refreshSession, async (req, res) => {
    
    let profiles = await db.getEndpoints.profiles([], false);

    let members = await db.getEndpoints.members();
    // get the member names...
    let memberUsernames = members.map(m => {
        return m.username;
    })

    // find the members that are not in the profiles
    let membersWithoutProfiles = memberUsernames.filter(m => {
        return !profiles.some(p => p.username === m);
    });

    console.log("Members:", members, "Profiles:", profiles, "Members without profiles:", membersWithoutProfiles);

    res.render(__dirname + '/views/profiles', {
        session: req.session,
        profiles: profiles,
        members: memberUsernames,
        membersWithoutProfiles: membersWithoutProfiles
    });
});

app.get(`${route}/posts`, refreshSession, async (req, res) => {
    
    let posts = await db.getEndpoints.posts();

    res.render(__dirname + '/views/posts', {
        session: req.session,
        posts: posts
    });
});

app.get(`${route}/template/:template*`, refreshSession, async (req, res) => {

    // also add the query parameters as variables to the template
    let query = req.query;
    let useData = {
        session: req.session
    };
    for(let key in query){
        useData[key] = query[key];
    }

    let template = req.params.template;

    console.log("Requested template:", template, "with query:", query);

    switch(template){
        case 'member_profile.ejs':
            // add all of the profile details to the template data
            let profiles = await db.getEndpoints.profiles([query.position]);
            // TODO: figure out something better than this
            if(profiles.length == 0){
                res.status(404).send('Profile not found');
                return;
            }

            useData.profiles = [];

            for(let i = 0; i < profiles.length; i++){
                let profile = profiles[i];
                let profileData = JSON.parse(profile.data);
                if(i % 2 == 0){
                    profileData.alternate = true;
                }
                useData.profiles.push({
                    ...profile,
                    ...profileData
                });
            }
            break;
        case "nav_bar.ejs":
            // need to get links from the nav_data.json file
            // generate into columns for the nav bar (done in ejs)

            let data = fs.readFileSync(__dirname + '/nav_data.json');
            let navData = JSON.parse(data);
            // data["categories"] has { link, name }
            // category["links"] has { link, name, special }


            useData.categories = navData["categories"] || [];
            break;
            
    }

    console.log("Rendering template:", template, "with data:", useData);

    
    res.render(__dirname + `/views/templates/${template}`, useData);
});

app.get(`${route}/post-view`, refreshSession, async (req, res) => {
    let id = req.query.post;

    let post = await db.getEndpoints.post(id);

    if(post.length == 0){
        res.status(404).send('Post not found');
        return;
    }

    post = post[0];

    res.render(__dirname + '/views/view_post', {
        session: req.session,
        post: post
    });
});

app.get(`${route}/nav_data.json`, refreshSession, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');

    db.initializeTables();

});

