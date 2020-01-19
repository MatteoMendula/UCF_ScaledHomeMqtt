var settings = require("./constant/settings");
var utils = require("./utils/utility");

var mqtt = require('mqtt');
var readline = require('readline');

var topic = "scaledhome";

const fs = require('fs');

//*
var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
//*/
var previous_temp = "initial_value";
var same_temp_counter = 0;
var max_temperature_SH = -100000;
var min_temperature_SH = 100000;

var lamp_state = 0; // -> maybe this has to be moved to a singleton class
var sensors_controller = {
    state: 0,
    conn_attempts: 0
};
var actuators_controller = {
    state: 0,
    conn_attempts: 0
};

// estimated uncertainty of measurement
// var delta = 0.2;

function init(client, topic){
    var log = "Starting init procedure";
    utils.myConsoleLog("init",log);
    saveOnFile("./log","log.txt",utils.myStringLog("init",log));
    //handleLamp(client,"off");

    client.publish(topic, "discovery: middleware looking for clients");

}

function handleLamp(client,action){
    var log = "Turning lamp "+action;
    utils.myConsoleLog("handleLamp",log);
    saveOnFile("./log","log.txt",utils.myStringLog("handleLamp",log));
    client.publish(topic, "lamp "+action);
    lamp_state = (action == "on") ? 1 : 0;
}

function writeFile(file_name,message){
    fs.appendFile(file_name, message, (err) => {
        // throws an error, you could also catch it here
        if (err){
            utils.myConsoleLog("writeFile","Unable to save on file \""+file_name+"\"",2);
            throw err;  
        }else{
            utils.myConsoleLog("writeFile","File \""+file_name+"\" saved successfully!",0)
        } 
    });
}

function saveOnFile(path, file_name,content){
    if (process.env._ && process.env._.indexOf("heroku") == -1){
        utils.myConsoleLog("saveOnFile","Writing on file-> "+file_name,0);
        writeFile(path+'/'+file_name,content);
    }else{
        utils.myConsoleLog("saveOnFile","Not saved on file because, thread is running on heroku",1);
    }
    
}

function updateMaxTemp(new_temp){
    var previous_temp = max_temperature_SH;
    max_temperature_SH = new_temp;
    var log = "Max temp has been updated from: "+previous_temp+" to: "+max_temperature_SH;
    utils.myConsoleLog("updateMaxTemp",log,0);
    saveOnFile("./log","log.txt",utils.myStringLog("updateMaxTemp",log));
}

function updateMinTemp(new_temp){
    var previous_temp = min_temperature_SH;
    min_temperature_SH = new_temp;
    var log = "Min temp has been updated from: "+previous_temp+" to: "+min_temperature_SH;
    utils.myConsoleLog("updateMinTemp",log);
    saveOnFile("./log","log.txt",utils.myStringLog("updateMinTemp",log));
}

// This function turns on and off the lamp depending on the SH outside temperature
// the goal is to force a fluctuation of the temperature in the range [min_temperature_SH,max_temperature_SH]
function checkTempBounds(client, out_temperature){
    utils.myConsoleLog("checkTempBounds","Received out temperature = "+ out_temperature);
    if (out_temperature < min_temperature_SH){
        updateMinTemp(out_temperature);
    }
    if (out_temperature > max_temperature_SH){
        updateMaxTemp(out_temperature);
    }

    // check if it is in a delta range?
    if (previous_temp == out_temperature){

        same_temp_counter++;

        console.log("same temperature counter:",same_temp_counter);

        if (same_temp_counter > 3){
            
            utils.myConsoleLog("checkTempBounds","Reached bound at "+out_temperature+"°F -> changing lamp state")
            if (lamp_state == 0){
                handleLamp(client,"on");
            } else if (lamp_state == 1){
                handleLamp(client,"off");
            }else{
                utils.myConsoleLog("checkTempBounds","Unknown lamp state");
            }

            same_temp_counter = 0;

        }
    }else{
        same_temp_counter = 0;
    }

    previous_temp = out_temperature;
}

var client  = mqtt.connect("mqtt://m12.cloudmqtt.com",
                            {
                                clientId:"mqttjs01",
                                username: "home_controller",
                                password: "home",
                                port: 11110
                            });

client.subscribe(topic,{qos:2});

client.on("connect",function(){	
    utils.myConsoleLog("main","connected to topic \"" + topic + "\"");
    init(client,topic);
});

client.on('message',function(topic, message){

    var mex = ''+message;

    utils.myConsoleLog("main","new mex \""+ mex + "\" from topic \""+ topic + "\"");

    if (!mex.includes("error")){
        
        var record = undefined;
          
        if (mex.includes("record:")){

            record = mex.split("record:")[1].split(',')

            var out_temperature = ''+record[1];

            checkTempBounds(client, out_temperature);   
        }else if (mex.includes("header:")){
            record = mex.split("header:")[1];
        }
        
        if (record != undefined){
            saveOnFile("./data","data.csv",record);  
        }

    }else if(mex.includes("discovery:")){
        var client = 
    }else{
        var log = "Bad message, discarding: "+mex;
        utils.myConsoleLog("main",log,1);
        saveOnFile("./log","log.txt",myStringLog("main",log,1));
    }
    
});

/*
    setTimeout(()=> {client.publish(topic, "close all");}, 3000);
//*/

//client.publish(topic,"hello");

//*

rl.prompt();

(function inputInterface(client,topic){
    rl.question('Type a command: ', (cmd) => {
        var cmd = ''+cmd;
      console.log(`Typed command is: ${cmd} + ${topic}`);
  
      if ( (settings.allowed_commands.includes(cmd)) || 
              ((cmd.split(" ")[0] == "open" || cmd.split(" ")[0] == "close")&& settings.allowed_motors.includes(parseInt(cmd.split(" ")[1])))){
            client.publish(topic,"cmd:"+cmd);
            var log = "sent cmd-> "+cmd;
            utils.myConsoleLog("inputInterface",log);
            saveOnFile("./log","log.txt",utils.myStringLog("inputInterface",log,0));
      }else{
            utils.myConsoleLog("inputInterface","Unknown command \"" + cmd + "\"",1);
      }
  
      inputInterface(client,topic);
    });
  })(client,topic);

rl.on('line', function (cmd) {

    // input.push(cmd);
    console.log(cmd);
});

rl.on('close', function (cmd) {
    process.exit(0);
});

//*/