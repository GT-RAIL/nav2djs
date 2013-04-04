/**
 * @author Russell Toris - rctoris@wpi.edu
 */

var NAV2D = NAV2D || {
  REVISION : '1'
};
/**
 * @author Russell Toris - rctoris@wpi.edu
 */

NAV2D.Navigator = function(options) {
  var that = this;
  var options = options || {};
  var ros = options.ros;
  var serverName = options.serverName || '/move_base';
  var actionName = options.actionName || 'move_base_msgs/MoveBaseAction';
  this.rootObject = options.rootObject || new createjs.Container();

  // get a handle to the stage
  if (that.rootObject instanceof createjs.Stage) {
    var stage = that.rootObject;
  } else {
    var stage = that.rootObject.getStage();
  }

  // marker for the robot
  var robotMarker = new ROS2D.NavigationArrow({
    size : 12,
    strokeSize : 1,
    fillColor : createjs.Graphics.getRGB(255, 128, 0, 0.66)
  });
  // wait for a pose to come in first
  robotMarker.visible = false;
  this.rootObject.addChild(robotMarker);

  // setup a listener for the robot pose
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
    robotMarker.scaleX = 1.0 / stage.scaleX;
    robotMarker.scaleY = 1.0 / stage.scaleY;

    // change the angle
    robotMarker.rotation = stage.rosQuaternionToGlobalTheta(pose.orientation);

    robotMarker.visible = true;
  });

  // setup a double click listener (no orientation)
  this.rootObject.addEventListener('dblclick', function(event) {
    // convert to ROS coordinates
    var coords = stage.globalToRos(event.stageX, event.stageY);
    console.log(coords);
  });
};
/**
 * @author Russell Toris - rctoris@wpi.edu
 */

NAV2D.OccupancyGridClientNav = function(options) {
  var that = this;
  var options = options || {};
  this.ros = options.ros;
  var topic = options.topic || '/map';
  var continuous = options.continuous;
  this.serverName = options.serverName || '/move_base';
  this.actionName = options.actionName || 'move_base_msgs/MoveBaseAction';
  this.rootObject = options.rootObject || new createjs.Container();
  this.viewer = options.viewer;

  this.navigator = null;

  // setup a client to get the map
  var client = new ROS2D.OccupancyGridClient({
    ros : this.ros,
    rootObject : this.rootObject,
    continuous : continuous
  });
  client.on('change', function() {
    that.navigator = new NAV2D.Navigator({
      ros : that.ros,
      serverName : that.serverName,
      actionName : that.actionName,
      rootObject : that.rootObject
    });
    
    // scale the viewer to fit the map
    that.viewer.scaleToDimensions(client.currentGrid.width, client.currentGrid.height);
  });
};
