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
  var ros = options.ros;
  var tfClient = options.tfClient || null;
  var map_topic = options.topic || '/map';
  var robot_pose = options.robot_pose || '/robot_pose';
  var continuous = options.continuous;
  var serverName = options.serverName || '/move_base';
  var actionName = options.actionName || 'move_base_msgs/MoveBaseAction';
  var rootObject = options.rootObject || new createjs.Container();
  var viewer = options.viewer;
  var withOrientation = options.withOrientation || false;
  var image = options.image || false;
  var old_state = null;

  // setup a client to get the map
  var client = new ROS2D.OccupancyGridClient({
    ros : ros,
    rootObject : rootObject,
    continuous : continuous,
    topic : map_topic
  });

  var navigator = new NAV2D.Navigator({
    ros: ros,
    tfClient: tfClient,
    serverName: serverName,
    actionName: actionName,
    robot_pose : robot_pose,
    rootObject: rootObject,
    withOrientation: withOrientation,
    image: image
  });

  client.on('change', function() {
    // scale the viewer to fit the map
    old_state = NAV2D.resizeMap(old_state, viewer, client.currentGrid);
  });
};
