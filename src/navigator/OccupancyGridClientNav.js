/**
 * @author Russell Toris - rctoris@wpi.edu
 */

/**
 * A OccupancyGridClientNav uses an OccupancyGridClient to create a map for use with a Navigator.
 *
 * @constructor
 * @param options - object with following keys:
 *   * ros - the ROSLIB.Ros connection handle
 *   * tfClient (optional) - Read information from TF
 *   * topic (optional) - the map topic to listen to
 *   * robot_pose (optional) - the robot topic or TF to listen position
 *   * rootObject (optional) - the root object to add this marker to
 *   * continuous (optional) - if the map should be continuously loaded (e.g., for SLAM)
 *   * serverName (optional) - the action server name to use for navigation, like '/move_base'
 *   * actionName (optional) - the navigation action name, like 'move_base_msgs/MoveBaseAction'
 *   * rootObject (optional) - the root object to add the click listeners to and render robot markers to
 *   * withOrientation (optional) - if the Navigator should consider the robot orientation (default: false)
 *   * image (optional) - the route of the image if we want to use the NavigationImage instead the NavigationArrow
 *   * viewer - the main viewer to render to
 */
NAV2D.OccupancyGridClientNav = function(options) {
  var that = this;
  options = options || {};
  this.ros = options.ros;
  this.tfClient = options.tfClient || null;
  var map_topic = options.topic || '/map';
  this.robot_pose = options.robot_pose || '/robot_pose';
  var continuous = options.continuous;
  this.serverName = options.serverName || '/move_base';
  this.actionName = options.actionName || 'move_base_msgs/MoveBaseAction';
  this.rootObject = options.rootObject || new createjs.Container();
  this.viewer = options.viewer;
  this.withOrientation = options.withOrientation || false;
  this.image = options.image || false;
  this.old_state = null;

  // setup a client to get the map
  var client = new ROS2D.OccupancyGridClient({
    ros : this.ros,
    rootObject : this.rootObject,
    continuous : continuous,
    topic : map_topic
  });

  this.navigator = new NAV2D.Navigator({
    ros: this.ros,
    tfClient: this.tfClient,
    serverName: this.serverName,
    actionName: this.actionName,
    robot_pose : this.robot_pose,
    rootObject: this.rootObject,
    withOrientation: this.withOrientation,
    image: that.image
  });

  client.on('change', function() {
    // scale the viewer to fit the map
    if(!that.old_state){
      that.old_state = {
        width: client.currentGrid.width,
        height: client.currentGrid.height,
        x: client.currentGrid.pose.position.x,
        y: client.currentGrid.pose.position.y
      };
      that.viewer.scaleToDimensions(client.currentGrid.width, client.currentGrid.height);
      that.viewer.shift(client.currentGrid.pose.position.x, client.currentGrid.pose.position.y);
    }
    if (that.old_state.width !== client.currentGrid.width || that.old_state.height !== client.currentGrid.height) {
      that.viewer.scaleToDimensions(client.currentGrid.width, client.currentGrid.height);
      that.old_state.width = client.currentGrid.width;
      that.old_state.height = client.currentGrid.height;
    }
    if (that.old_state.x !== client.currentGrid.pose.position.x || that.old_state.y !== client.currentGrid.pose.position.y) {
      that.viewer.shift((-that.old_state.x+client.currentGrid.pose.position.x)/1, (-that.old_state.y+client.currentGrid.pose.position.y)/1);
      that.old_state.x = client.currentGrid.pose.position.x;
      that.old_state.y = client.currentGrid.pose.position.y;
    }
  });
};
