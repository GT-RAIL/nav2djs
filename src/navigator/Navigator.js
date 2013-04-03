/**
 * @author Russell Toris - rctoris@wpi.edu
 */

NAV2D.Navigator = function(options) {
  var options = options || {};
  var ros = options.ros;
  var serverName = options.serverName || '/move_base';
  var actionName = options.actionName || 'move_base_msgs/MoveBaseAction';
  this.rootObject = options.rootObject || new createjs.Container();
  
  // add a marker for the robot
  var robotMarker = new createjs.Shape();
  robotMarker.graphics.beginFill('rgba(255,0,0,0.5)').drawCircle(0, 0, 1);
  this.rootObject.addChild(robotMarker);
  
  robotMarker.addEventListener('click', function(){
    console.log('test');
  });
  
  //setup a listener for the robot pose
  var poseListener = new ROSLIB.Topic({
    ros : ros,
    name : '/robot_pose',
    messageType : 'geometry_msgs/Pose',
    throttle_rate : 100
  });
  poseListener.subscribe(function(pose) {
    // update the robots position on the map
    robotMarker.x = pose.position.x;
    robotMarker.y = -pose.position.y;
  });
  
  // setup a double click listener (no orientation)
  this.rootObject.addEventListener('dblclick', function(event) {
    console.log(event);
  });
  
};
