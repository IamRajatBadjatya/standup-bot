var firebase = require('firebase-admin');
var restify = require('restify');
var builder = require('botbuilder');
var moment = require('moment');
// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 9100, function() {
  console.log('%s listening to %s', server.name, server.url);
});
//Setup and configure firebase
var serviceAccount = require('./standup-bot-1-firebase-adminsdk');

firebase.initializeApp({
  credential: firebase.credential.cert(serviceAccount),
  databaseURL: 'https://standup-bot-1.firebaseio.com'
});

//Database reference
var dB = firebase.database();
// Create chat connector for communicating with the Bot Framework Service
var connector = new builder.ChatConnector({
  appId: process.env.MicrosoftAppId,
  appPassword: process.env.MicrosoftAppPassword
});
// Listen for messages from users
server.post('/api/messages', connector.listen());
// Receive messages from the user and respond by echoing each message back (prefixed with 'You said:')
var inMemoryStorage = new builder.MemoryBotStorage();
var statusList = [];
var projectId = 'p_101';
var users = [{ name: 'Rajat', id: '101' }, { name: 'Dhruv', id: '102' }];
var questions = [
  { field: 'yTask', prompt: 'What did you do yesterday?' },
  { field: 'tTask', prompt: 'What you are planning to do today?' },
  { field: 'blocker', prompt: 'Any blocker?' }
];

// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, [
  function(session) {
    if (session.message.text.includes('Start')) {
      if (session.message.user.name === 'rajatbadjatya') {
        console.log('default flow');
        session.beginDialog('statusDialog');
      } else {
        session.send(
          'You are not an authorized user to start this standup',
          session.message.text
        );
      }
    }else {
      session.endDialog();
    }
  },
  (session, results) => {
    session.send('Conclusion');
    console.log(JSON.stringify(results.response));
    var tasksRef = dB.ref().child('tasks');
    //var objToSend = [];
    for (i = 0; i < users.length; i++) {
      var user = users[i];
      var obj = {};
      var taskId = `${projectId}_${moment(new Date()).format('DD-MM-YYYY')}_${
        user.id
      }`;
      obj = {
        yTask: results.response[taskId].yTask,
        tTask: results.response[taskId].tTask,
        blocker: results.response[taskId].blocker
      };
      tasksRef.child(taskId).set(obj);
      session.send(
        `${users[i].name}: <br> ${results.response[taskId].yTask} <br> ${
          results.response[taskId].tTask
        } <br> ${results.response[taskId].blocker}`
      );
    }
  }
]).set('storage', inMemoryStorage);

// bot
//   .dialog('InitialDialo', [
//     session => {
//       if (session.message.user.name === 'User')
//         session.beginDialog('statusDialog');
//       else session.send('You are not an authorized user to start this standup');
//     },
//     (session, results) => {
//       session.send('Conclusion');
//       console.log(JSON.stringify(results.response));
//       var tasksRef = dB.ref().child('tasks');
//       //var objToSend = [];
//       for (i = 0; i < users.length; i++) {
//         var user = users[i];
//         var obj = {};
//         var taskId = `${projectId}_${moment(new Date()).format('DD-MM-YYYY')}_${
//           user.id
//         }`;
//         obj = {
//           yTask: results.response[taskId].yTask,
//           tTask: results.response[taskId].tTask,
//           blocker: results.response[taskId].blocker
//         };
//         tasksRef.child(taskId).set(obj);
//         session.send(
//           `${users[i].name}: <br> ${results.response[taskId].yTask} <br> ${
//             results.response[taskId].tTask
//           } <br> ${results.response[taskId].blocker}`
//         );
//       }
//     }
//   ])
//   .triggerAction({
//     matches: /^Start$/i
//   });
// // This bot ensures user's profile is up to date.
// var bot = new builder.UniversalBot(connector, [
//   function(session) {
//     console.log(moment(new Date()).format('DD-MM-YYYY'));
//     session.beginDialog('statusDialog');
//   },
//   function(session, results) {
//     session.send('Conclusion');
//     console.log(JSON.stringify(results.response));
//     var tasksRef = dB.ref().child('tasks');
//     //var objToSend = [];
//     for (i = 0; i < users.length; i++) {
//       var user = users[i];
//       var obj = {};
//       var taskId = `${projectId}_${moment(new Date()).format('DD-MM-YYYY')}_${user.id}`
//       obj = {
//         yTask : results.response[taskId].yTask,
//         tTask: results.response[taskId].tTask,
//         blocker: results.response[taskId].blocker
//       };
//       tasksRef.child(taskId).set(obj);
//       session.send(
//         `${users[i].name}: <br> ${results.response[taskId].yTask} <br> ${
//           results.response[taskId].tTask
//         } <br> ${results.response[taskId].blocker}`
//       );
//     }
//   }
// ]).set('storage', inMemoryStorage); // Register in-memory storage

bot.dialog('statusDialog', [
  function(session, args, next) {
    // Save previous state (create on first call)
    session.dialogData.userIndex = args ? args.userIndex : 0;
    session.dialogData.questionIndex = args ? args.questionIndex : 0;
    session.dialogData.statusList = args ? args.statusList : {};
    session.dialogData.status = args ? args.status : {};
    builder.Prompts.text(
      session,
      `Hello ${session.message.user.name}, ${
        questions[session.dialogData.questionIndex].prompt
      }`
    );
  },
  function(session, results) {
    // Save users reply
    var field = questions[session.dialogData.questionIndex++].field;
    session.dialogData.status[field] = results.response;
    var user = users[session.dialogData.userIndex];
    var taskId = `${projectId}_${moment(new Date()).format('DD-MM-YYYY')}_${
      user.id
    }`;
    session.dialogData.statusList[taskId] = session.dialogData.status;
    // Check for end of form
    if (session.dialogData.questionIndex >= questions.length) {
      // Return completed form
      session.dialogData.status = {};
      session.dialogData.questionIndex = 0;
      session.dialogData.userIndex++;
    }
    if (session.dialogData.userIndex >= users.length) {
      session.endDialogWithResult({ response: session.dialogData.statusList });
    } else {
      session.replaceDialog('statusDialog', session.dialogData);
    }
  }
]);
