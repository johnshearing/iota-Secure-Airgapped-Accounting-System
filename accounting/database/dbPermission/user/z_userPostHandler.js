// user - post subhandler
// Define the user post subhandler function.
// This function appends a record to the user file.
user._user.post = function(data, callback)
{
  // Field validation starts here.
  // Get email from payload;
  let email = data.payload.email;

  // passIfString Default behavior from meta.js
  // qif5xwvzgr7efln9xtr8
  if (typeof(email) != 'string'){return callback(400, {'Error' : 'email must be of datatype string'});};

  // passIfNotEmpty Default behavior from meta.js
  // eojwivwlhxkm1b837n2o
  if(!email || email.trim().length === 0){return callback(400, {'Error' : 'No email was entered'});}else{email = email.trim()};

  // passIfHasAmpersand
  // uet9z3uuzgy5hmytmsxf 
  if (email.indexOf("@") === -1){return callback(400, {'Error' : 'Not a valid email'});}

  // Get password from payload;
  let password = data.payload.password;

  // passIfString Default behavior from meta.js
  // qif5xwvzgr7efln9xtr8
  if (typeof(password) != 'string'){return callback(400, {'Error' : 'password must be of datatype string'});};

  // passIfNotEmpty
  // bet9z4ufzg97hmfdhmxt 
  if(!password){return callback(400, {'Error' : 'No password was entered'});};

  // passIfHasNumber
  // 5et9z9uuzgy5hmfdmmxf 
  // declare a function used to check if the password has a number in it.
  function passwordDoesNotHaveNumber (password)
  {
    let str = String(password);
    
    for( let i = 0; i < str.length; i++)
    {
      if(!isNaN(str.charAt(i)))
      {
        return false;
        break;
      } 
    } 
    return true;
  };

  if(passwordDoesNotHaveNumber(password)){return callback(400, {'Error' : 'password must contain a number.'});};


  // Enforcing uniqueness of the email field.
  // Will toggle this to false if we find the email already exists in user.
  let emailIsUnused = true;

  // Using this to track the primary key of a record that we might encounter with the candidate email address.
  // If we encounter this primary key again we will check to see if the email has been changed.
  // If it has then the candidate email will be marked as available again.
  let uniqueIdOfRecordHoldingCandidateEmail = false; 
                        

  // To ensure the email is unique we will read every record in 
  // user and compare with the email provided.

  // This function sets up a stream where each chunk of data is a complete line in the user file.
  let readInterface = readline.createInterface
  (
    { // specify the file to be read.
      input: fs.createReadStream(_data.baseDir + '/database/dbPermission/user' + '/' + 'user' + '.json')
    }
  );
  
  // Look at each record in the file and set a flag if the email matches the email provided by the user.
  readInterface.on('line', function(line) 
  {
    // Convert the JSON string from user into an object.
    lineObject = JSON.parse(line);

    // Several different record sets with the supplied email and the same userId 
    // may exist already if the record has been changed or deleted prior to this operation.

    // A modified record is simply a new record with the same userId as an existing record.
    // The newest record is the valid record and the older record is history.  
    // So position matters. These tables should never be sorted.
    // These tables can be packed however to get rid of historical records.

    // The transaction log also maintains the history and the current state of the entire database.
    // So the transaction log can be used to check the integrity of the every table.
    // No records in the transaction log should be removed.

    // A deleted record in this system is simply an identical record appended with 
    // the deleted field set to true. 
    // So depending on how many times the email has been added and deleted there may 
    // be several sets of records in the user table currently 
    // that have the same email and the same userId.
    // The table can be packed occasionally to get rid of these deleted record sets. 
    // Deletes are handled as appends with the deleted field set to true because real 
    // deletes tie up the table for a long time.

    // In this table, the email is a unique key as well as the userId.

    // When adding a record we first make sure that the record does NOT already exist.
    // There should be no record with the current email or if there is then 
    // the last record with this email must have the deleted field set to true.

    // When changing a record we:
    // 1. Make sure that the record with this email does indeed exist and...
    // 2. that the last instance of a record with this email is not deleted.
  
    // It is ok to add a new record with this same email again when the last instance 
    // of this record encountered in the stream has the deleted flag set to true. 
    // In that case, the userId will be different but the email will be the same.         

    // As explained above, only the last matching record for a particular email matters.
    // It's like that old game "She loves me, She loves me not".

    if (email == lineObject.email) // we found a matching entry
    {
      if (lineObject.deleted == false) // The record has not been deleted so it's a duplicate. Not unique.
      {
        emailIsUnused = false; // This flag used in the on close event listener below. 

        // If this record (record with this primary key) is encountered further down where it has been deleted 
        // or where the email has been changed with a put operation:
        // Then the candidate email will be available again as we continue searching through the records.
        // We are already checking if this email becomes available again by deletion.
        // Now we need to check if the email becomes available because the record with this primary 
        // key gets changed with a new email address.
        // That will make the candidate email unique and available again.
        // So record this global sequential unique id (the userId in this case).
        // If we find the gsuid again, then check if the email has changed.
        // If it has been changed then:
        // 1. Set the emailIsUnused flag to true again
        // 2. clear out the variable tracking the uniqueId of the record.
        uniqueIdOfRecordHoldingCandidateEmail = lineObject.userId;
      }
      // The matching record we found has been deleted so it may as well not exist. The new record is still unique.
      else 
      {
        emailIsUnused = true;
      } 
    } // End of: if we found a matching entry

    // If we have seen this primary key before and flagged the email already taken 
    // because it was identical to the email we are trying to add and it had not been deleted:

    // Ok, the current record is not holding the candidate email but 
    // maybe it was in the past and someone changed it.
    // if the candidate email is flagged unavailable and we are looking at the record that was flagged:
    else if(emailIsUnused === false && uniqueIdOfRecordHoldingCandidateEmail === lineObject.userId)
    {
      // Check if the email is no longer holding the candidate email.
      // If it is not holding the candidate email then flag the email 
      // available again and clear out the variable tracking this primary key.
      emailIsUnused = true;
      uniqueIdOfRecordHoldingCandidateEmail = false;
    }

  }); // End of: readInterface.on('line', function(line){...}
  // End of: Look at each record...




  // This listener fires after we have discovered if the email is 
  // unique or not, and have then closed the readable stream from user.
  // The callback function defined here will append the record if the email 
  // was found to be unique.
  readInterface.on('close', function() 
  {
    // If the email already exists then exit this process without appending the record.
    if (!emailIsUnused) 
    {      
      helpers.log
      (
        5,
        '6dgqop2ngtbfjej4sgho' + '\n' +
        'The email address: ' + email + ' already exists' + '\n'                                  
      ); // End of: helpers.log(...)

      return callback(400, {'Error' : 'The email already exists'});
    }

    // If we made it to this point then the candidate email is unique so continue on with the append opperation.    

            
    // Password calculation is processed here.
    // het9z9uuzgy5hmfwdgkz
    // Hash the password
    var hashedPassword = helpers.hash(password);

    // If the password was not hashed successfully then exit this process without appending the record.
    if(!hashedPassword)
    {
      helpers.log
      (
        5,
        'zet9z4uuzg95hmfdmmx5' + '\n' +
        'Could not hash the password' + '\n'
      ); // End of: helpers.log(...)

      return callback(500, {'Error' : 'Could not hash the password'});
    } // End of: else the password was not hashed successfully.


    // Get the next global sequential unique Id and lock the database
    // Locking the database makes the system multiuser.
    // All writes to any table must first get a lock on gsuid.json
    // gsuid.json stays locked until the operation is completely finished and _data.removeLock is called.
    // This ensures that only one process is writing to the database at any one time.  
    // If the transaction fails or if it requires a rollback then the lock will remain until an administrator removes it.
    // This will halt all writes to the database until the administrator has had a chance to investigate.       
    _data.nextId(function(error, nextIdObject)
    {

      // If we were unable to get the next gsuid then exit this process without appending the record. 
      if(error || !nextIdObject)
      {
        helpers.log
        (
          5,
          'eoqq30ksj1pgorgrc59c' + '\n' +
          'Unable to get the next gsuid.' + '\n' +
          'The following was the error' + '\n' +
          JSON.stringify(error) + '\n'                                   
        ); // End of: helpers.log(...)

        return callback('Unable to get the next gsuid.');
      }


      // If we got this far then we were able to lock the gsuid.json file and get the next 
      // unique id number for this record so continue on.



      // Create the user object. 
      // This object will be appended to user.json.
      var userObject = 
      {
          "userId" : nextIdObject.nextId,
          "email" : email,
          "hashedPassword" : hashedPassword,
          "timeStamp" : Date.now(),
          "deleted" : false
      };

      // Create the logObject.
      // This object will be written to history.json which maintains a history of 
      // all changes to all tables in the database.
      var logObject =
      {
        "historyId" : nextIdObject.nextId + 1,                 
        "transactionId" : nextIdObject.nextId + 2,            
        "rollback" : false,
        "process" : "user._user.post",
        "comment" : "Post new record",
        "who" : "No login yet",    
        "user" : userObject   
      }

      // Calling the function which creates an entry into the database log file.
      _data.append
      (
        'database/dbHistory', 
        'history', 
        logObject, 
        function(err)
        {
          // If there was an error appending to the history file then exit this process
          if (err)  
          {
            helpers.log
            (
              7,
              '1yhjgxzpf197hf54xqnn' + '\n' +
              'There was an error appending to the history file' + '\n' +
              'An error here does not necessarily mean the append to history did not happen.' + '\n' +  
              'But an error at this point in the code surely means there was no append to user' + '\n' +                                          
              'CHECK TO SEE IF history and user ARE STILL IN SYNC' + '\n' +                    
              'The following was the record we tried to append:' + '\n' +
              JSON.stringify(logObject) + '\n' +                   
              'The following is the error message:' + '\n' +                  
              err  + '\n'
            );

            return callback(500, {'Error' : 'Could not create a new user record.'});
          }



          // The history file has been appended to successfully so continue on.



          // Calling the function which appends a record to the file user.json
          _data.append
          (
          '/database/dbPermission/user', 
          'user', 
          userObject, 
          function(err)
          {
            if (!err)  // The file has been appended to successfully.
            {
              // Call to function which removes lock
              _data.removeLock
              (function(error)
              // start of callback code which is run after attempting to remove the lock.
              {
                if(!error) // Database lock was successfully removed.
                {
                  callback(200); 
                }
                else // Good write but unable to remove lock on database.
                {
                  helpers.log // Log the error.
                  (
                    7,
                    'wx9gefa8qnmbs446lsqx' + '\n' +
                    'Successful write to user but unable to remove lock on database' + '\n' +
                    'The following record was appended to the user file:' + '\n' +                            
                    JSON.stringify(logObject) + '\n' +   
                    'The following was the error message:' + '\n' +                                             
                    error + '\n'
                  ); // End of: helpers.log. Log the error.

                  return callback(500, {'Error' : 'Successful write to user but unable to remove lock on database'});

                } // End of: else Good write but unable to remove lock on database.

              } // End of callback code which is run after attempting to remove the lock.
              ); // End of: _data.removeLock(function(error){...}
              // End of: Call to function which removes lock

            }    // End of: if (!err)  //The file has been appended to successfully.
            else // There was an error appending to user.
            {
              helpers.log // Log the error.
              (
                5,
                'yvd10227ru86a3vg6aev' + '\n' +
                'There was an error when appending to the user file.' + '\n' +
                'The following record may or may not have been appended to the user file:' + '\n' +                            
                JSON.stringify(logObject) + '\n' +
                'Attempting to rollback the entry.' + '\n' +    
                'The following was the error message:' + '\n' +                                             
                err + '\n'            
              );

              // Assemble rollback record for the user file which will negate previous entry if any.  
              userObject = 
              {
                "userId" : nextIdObject.nextId,
                "email" : "email",
                "hashedPassword" : "hashedPassword",
                "timeStamp" : Date.now(),
                "deleted" : true
              };                        

              // Assemble rollback record for the history file which will negate previous entry if any.
              logObject =
              {
                "historyId" : nextIdObject.nextId + 3,                             
                "transactionId" : nextIdObject.nextId + 2,                        
                "rollback" : true,
                "process" : "user._user.post",
                "comment" : "Error posting. Appending a delete.",                        
                "who" : "Function needed",    
                "user" : userObject   
              }

              // Start the rollback process.
              _data.append // Append a rollback entry in history.
              (
                'database/dbHistory', 
                'history', 
                logObject, 
                function(err)
                {
                  if (!err) // The roll back entry in history was appended successfully.
                  {
                    // Calling the function which appends a record to the file user.json
                    _data.append
                    (
                      '/database/dbPermission/user', 
                      'user', 
                      userObject, 
                      function(err)
                      {
                        if (!err) // The rollback record for user was appended successfully.
                        {
                          helpers.log
                          (
                            5,
                            '5i463rjvjfcsfx4mwp7z' + '\n' +
                            'Rollback entry in the user file was appended successfully' + '\n' +
                            'The following was the record we rolled back:' + '\n' +
                            JSON.stringify(logObject) + '\n'                                   
                          ); // End of: helpers.log(...)
                        }
                        else // There was an error when rolling back record for user.
                        {
                          helpers.log
                          (
                            7,
                            'q87jvperiifonsdmmfl1' + '\n' +
                            'There was an error appending a rollback entry in the user file' + '\n' +
                            'The following record may or may not have been rolled back:' + '\n' +
                            JSON.stringify(logObject) + '\n' +   
                            'An error here does not necessarily mean the deleting append to user did not happen.' + '\n' +                                        
                            'CHECK TO SEE IF history and user ARE STILL IN SYNC' + '\n' + 
                            'The following is the error message:' + '\n' +                                                                     
                            err  + '\n'
                          ); // End of: helpers.log(...)
                        }

                      } // End of: callback function(err){...}
                    ); // End of: _data.append(...)
                    
                  } // End of: The roll back entry in history was appended successfully.
                  else // There was an error when appending a rollback entry in history.
                  { 
                    helpers.log
                    (
                      7,
                      'nkes6tnwjn8fiab8og9f' + '\n' +
                      'There was an error appending a rollback entry in the history file' + '\n' +
                      'A rollback entry may or may not have been written in the user file' + '\n' +  
                      'CHECK TO SEE IF history and user ARE STILL IN SYNC' + '\n' +                                      
                      'The following was the record we tried to roll back:' + '\n' +
                      JSON.stringify(logObject) + '\n' +        
                      'The following is the error message:' + '\n' +
                      err  + '\n'
                    );
                  } // End of: else There was an error when appending a rollback entry in history.
                } // End of: callback function(err){...}
              ); // End of: _data.append(...) Append a rollback entry in history.

              return callback(500, {'Error' : 'Could not create the new user.'});              

            } // End of: else // There was an error appending to user.
          } // End of: callback function
          ); // End of: Calling the function which appends a record to the file user.json 
        } // End of: callback function
      ); // End of: _data.append(dbHistory...)
      // End of: Calling the function which creates an entry into history. 
    }); // End of: lib.nextId(function(err, nextIdObject)
  }); // End of: readInterface.on('close', function(){...}
}; // End of: user._user.post = function(...
// End of: user - post subhandler