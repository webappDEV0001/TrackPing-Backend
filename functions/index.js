const functions = require('firebase-functions');
const admin = require('firebase-admin');
const turf = require('@turf/turf');

admin.initializeApp();

var db = admin.database();
var usersRef = db.ref('/users');

/**
 * fetach near people.
 */
exports.fetchNearPeople = functions.https.onRequest((request, response) => {
  const myUserId = request.query.user_id;
  const myDeviceId = request.query.device_id;
  const radius = request.query.radius;

  usersRef.once('value', function(snapshot) {
    let allData = snapshot.val();

    let current_location = allData[myUserId][myDeviceId].currentLocation;
    
    let myLat = current_location.latitude;
    let myLong = current_location.longitude;
    const myLocation = turf.point([myLat, myLong]);

    var arrResult = []
    Object.keys(allData).forEach(function(userId) {
      if (myUserId != userId) {
        let userData = allData[userId]
        Object.keys(userData).forEach(function(deviceId) {
          if (deviceId != 'profile' && deviceId != 'followings' && deviceId != 'followers') {
            let deviceInfo = userData[deviceId]
            let currentLocation = deviceInfo['currentLocation']
            if (currentLocation != undefined) {
              var to = turf.point([currentLocation.latitude, currentLocation.longitude]);
              var options = {units: 'kilometers'}
    
              var distance = turf.distance(myLocation, to, options);
    
              if (distance <= radius) {
                var isFollower = null
                let followers = allData[myUserId]['followers']
                if (followers) {
                  Object.keys(followers).forEach(function(followerId) {
                    if (followerId == userId) {
                      isFollower = followers[followerId]
                    }
                  });
                }
                
                let userInfo = {
                  userId: userId,
                  profile: userData["profile"],                  
                  isFollower: isFollower
                }    
                arrResult.push(userInfo);
              }            
            }
          }
        });
      }
    });

    response.json({ result: arrResult });
    
  }, function(errorObject) {
    console.log("The read failed: " + errorObject.code);
    response.send("The read failed: " + errorObject.code);
  });
});

/**
 * send invite notification
 */
exports.sendFollowInviteNotification = functions.https.onRequest((request, response) => {
  const fromId = request.query.fromId;
  const toId = request.query.toId;

  var registrationTokens = [];

  usersRef.once('value', function(snapshot) {
    let allData = snapshot.val();

    let sender = allData[fromId];
    let receiver = allData[toId];
    
    let senderName = sender['profile']['name']
    
    Object.keys(receiver).forEach(function(deviceId) {
      if (deviceId != 'profile' && deviceId != 'followings' && deviceId != 'followers') {
        let deviceInfo = receiver[deviceId]
        let fcmToken = deviceInfo['fcmToken']
        registrationTokens.push(fcmToken)
      }
    });

    var payload = {
      notification: {
        title: '',
        body: senderName + ' has sent a request to follow you.'
      },
      data: {
        title: 'follow request'
      }
    };

    admin.messaging().sendToDevice(registrationTokens, payload).then(function(res) {
      console.log('Successfully sent message:', res);
      usersRef.child(fromId).child('followers').child(toId).set({
        accepted: false,
        declined: false
      });

      usersRef.child(toId).child('followings').child(fromId).set({
        accepted: false,
        declined: false
      });

      response.json({ result: 'success' });
    }).catch(function(error) {
      console.log('Error sending message:', error);
      response.json({ result: 'failed' });
    });
  }, function(errorObject) {
    console.log("The read failed: " + errorObject.code);
    response.json({ result: "failed" });
  });
});


/**
 * Get Following requests
 * 
 */
// exports.getFollowingRequests = functions.https.onRequest((request, response) => {
//   const myUserId = request.query.userId

//   usersRef.once('value', function(snapshot) {
//     let allData = snapshot.val();

//     var arrResult = []
//     Object.keys(allData).forEach(function(userId) {
//       if (myUserId != userId) {
//         let followings = allData[userId]['followings']
//         if (followings != undefined) {
//           Object.keys(followings).forEach(function(followingId) {
//             if (followingId == myUserId) {
//               let profile = allData[userId]['profile']
//               let userName = ''
//               if (profile != undefined) {
//                 userName = profile['name']
//               }
//               let status = followings[followingId]
//               if (status.accepted == false && status.accepted == false) {
//                 let following = {
//                   userId: userId,
//                   userName: userName,
//                   status: followings[followingId]
//                 }
//                 arrResult.push(following)
//               }              
//             }
//           });
//         }
//       }
//     });

//     response.json({ result: arrResult });
    
//   }, function(errorObject) {
//     console.log("The read failed: " + errorObject.code);
//     response.send("The read failed: " + errorObject.code);
//   });
// });