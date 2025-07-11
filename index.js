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
    service_url     : 'https://usg.mtu.edu/',
    cas_version     : '3.0',
    renew           : false,
    is_dev_mode     : false,
    dev_mode_user   : 'djreeves',
    dev_mode_info   : {
        displayName: "David Reeves",
        givenName: "David",
        sn: "Reeves",
        mail: "djreeves@mtu.edu",
        UID: "djreeves",
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

app.get(`${route}/session`, (req, res) => {
    // return an object with the session data
    let obj = {
        user: req.session.user,
        user_info: req.session.user_info
    };

    res.json(obj);
});

let permanentAdmins

app.get(`${route}/authenticate`, cas.bounce, async (req, res) => {

    let username = req.session.user;
    console.log("Authenticated user:", username);

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

    let user_info = req.session.user_info;
    req.session.user_info = {
        ...memberObj,
        ...user_info
    };

    // usg user is automatically an admin

    res.redirect('/internal');
});

app.get(`${route}/logout`, cas.logout, (req, res) => {
    res.redirect('/internal');
});

app.get(`/test`, (req, res) => {
    res.sendFile(__dirname + '/testing/member-profile.html');
});

app.get(`/nav_data.json`, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

// get any file
// specified by the path /uploaded/*
app.get(`${route}/uploaded/*`, (req, res) => {

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

app.get(`${route}/`, (req, res) => {

    console.log("SESSION", req.session);

    res.render(__dirname + '/views/index', {
        session: req.session
    });
});

app.get(`${route}/access`, async (req, res) => {

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

app.get(`${route}/navigation`, async (req, res) => {



    res.render(__dirname + '/views/navigation', {
        session: req.session
    });
});

app.get(`${route}/profile`, async (req, res) => {

    let user = 'djreeves';
    if(req.query.profile){
        user = req.query.profile;
    }

    let profile = await db.getEndpoints.profile(user);
    if(profile.length == 0){
        res.status(404).send('Profile not found');
        return;
    }

    profile = profile[0];

    res.render(__dirname + '/views/profile', {
        session: req.session,
        profile: profile
    });
});

app.get(`${route}/profiles`, async (req, res) => {
    
    let profiles = await db.getEndpoints.profiles();

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

app.get(`${route}/posts`, async (req, res) => {
    
    let posts = await db.getEndpoints.posts();

    res.render(__dirname + '/views/posts', {
        session: req.session,
        posts: posts
    });
});

app.get(`${route}/template/:template*`, async (req, res) => {

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

    if(template == 'member_profile.ejs'){
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

    }

    console.log("Rendering template:", template, "with data:", useData);

    
    res.render(__dirname + `/views/templates/${template}`, useData);
});

app.get(`${route}/post-view`, async (req, res) => {
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

app.get(`${route}/nav_data.json`, (req, res) => {
    // return usg.mtu.edu/nav_data.json

    let data = fs.readFileSync(__dirname + '/nav_data.json');

    res.send(data);
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');

    db.initializeTables();

});

