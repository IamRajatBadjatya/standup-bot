var firebase = require('firebase-admin');
var restify = require('restify');
var builder = require('botbuilder');
var moment = require('moment');
var schedule = require('node-schedule');

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
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
var user = {
  name: 'Rajat',
  id: '101'
};
var questions = [
  {
    field: 'yTask',
    prompt: 'What did you do yesterday?'
  },
  {
    field: 'tTask',
    prompt: 'What you are planning to do today?'
  },
  {
    field: 'blocker',
    prompt: 'Any blocker?'
  }
];

function startProactiveDialog(address) {
  console.log('==============>inside start Proactive dialog<==============');
  // bot.endDailog();
  bot.beginDialog(address, 'statusDialog');
}
// Create your bot with a function to receive messages from the user
// This default message handler is invoked if the user's utterance doesn't
// match any intents handled by other dialogs.
var bot = new builder.UniversalBot(connector, [
  function(session) {
    // initiate a dialog proactively
    savedAddress = session.message.address;
    var message =
      "Hello, it's time to start the daily standup. Please answer the following questions:";
    session.send(message);
    var rule = new schedule.RecurrenceRule();
    rule.minute = 1;
    session.beginDialog('statusDialog');
    var j = schedule.scheduleJob(rule, function() {
      console.log('-----------inside job scheduler-------------');
      startProactiveDialog(savedAddress);
    });
  }
]).set('storage', inMemoryStorage);

// Send welcome when conversation with bot is started, by initiating the root dialog
bot.on('conversationUpdate', function(message) {
  if (message.membersAdded) {
    message.membersAdded.forEach(function(identity) {
      if (identity.id === message.address.bot.id) {
        console.log('inside conversation update');
        bot.beginDialog(message.address, '/');
      }
    });
  }
});

bot.dialog('statusDialog', [
  (session, args, next) => {
    console.log('==========>inside status dialog <========');
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
  (session, results) => {
    // Save users reply
    var field = questions[session.dialogData.questionIndex++].field;
    session.dialogData.status[field] = results.response;
    var taskId = `${projectId}_${moment(new Date()).format('DD-MM-YYYY')}_${
      user.id
    }`;
    session.dialogData.statusList[taskId] = session.dialogData.status;
    // Check for end of form
    if (session.dialogData.questionIndex < questions.length) {
      // Return completed form
      // session.dialogData.status = {};
      // session.dialogData.questionIndex = 0;
      session.replaceDialog('statusDialog', session.dialogData);
    } else {
      session.send('Conclusion');
      console.log(JSON.stringify(session.dialogData.statusList));
      var tasksRef = dB.ref().child('tasks');
      var obj = {};
      var taskId = `${projectId}_${moment(new Date()).format('DD-MM-YYYY')}_${
        user.id
      }`;
      obj = {
        yTask: session.dialogData.statusList[taskId].yTask,
        tTask: session.dialogData.statusList[taskId].tTask,
        blocker: session.dialogData.statusList[taskId].blocker
      };
      tasksRef.child(taskId).set(obj);
      session.send(
        `${user.name}: <br> ${
          session.dialogData.statusList[taskId].yTask
        } <br> ${session.dialogData.statusList[taskId].tTask} <br> ${
          session.dialogData.statusList[taskId].blocker
        }`
      );
      session.endDialog();
    }
  }
]);