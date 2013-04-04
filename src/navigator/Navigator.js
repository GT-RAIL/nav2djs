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

  // setup the actionlib client
  var actionClient = new ROSLIB.ActionClient({
    ros : ros,
    actionName : actionName,
    serverName : serverName
  });

  /**
   * Send a goal to the navigation stack with the given pose.
   * 
   * @param pose - the goal pose
   */
  var sendGoal = function(pose) {
    // create a goal
    var goal = new ROSLIB.Goal({
      actionClient : actionClient,
      goalMessage : {
        target_pose : {
          header : {
            frame_id : '/map'
          },
          pose : pose
        }
      }
    });
    goal.send();

    goal.on('status', function(status) {
      console.log(status);
    });
    goal.on('feedback', function(feedback) {
      console.log(feedback);
    });
  };

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
    var pose = new ROSLIB.Pose({
      position : new ROSLIB.Vector3(coords)
    });
    // send the goal
    sendGoal(pose);
  });
};
