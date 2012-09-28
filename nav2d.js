/*********************************************************************
 *
 * Software License Agreement (BSD License)
 *
 *  Copyright (c) 2012, Worcester Polytechnic Institute
 *  All rights reserved.
 *
 *  Redistribution and use in source and binary forms, with or without
 *  modification, are permitted provided that the following conditions
 *  are met:
 *
 *   * Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 *   * Redistributions in binary form must reproduce the above
 *     copyright notice, this list of conditions and the following
 *     disclaimer in the documentation and/or other materials provided
 *     with the distribution.
 *   * Neither the name of the Worcester Polytechnic Institute nor the 
 *     names of its contributors may be used to endorse or promote 
 *     products derived from this software without specific prior 
 *     written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 *  "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 *  LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 *  FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 *  COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
 *  INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 *  BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 *  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 *  CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT
 *  LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
 *  ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 *
 *   Author: Russell Toris
 *  Version: September 24, 2012
 *
 *********************************************************************/

/* 
   Converted to AMD by Jihoon Lee
   Version: September 27, 2012
 */

(function (root, factory) {
    if(typeof define === 'function' && define.amd) {
        define(['jquery','eventemitter2','actionclient','map'],factory);
    }
    else {
        root.Nav2D = factory(root.jquery,root.EventEmitter2,root.ActionClient,root.Map);
    }
 }(this,function(jquery,EventEmitter2,ActionClient,Map)
{
    var Nav2D = function(options) {
	var nav2D = this;
	options = options || {};
	nav2D.ros = options.ros;
	nav2D.serverName = options.serverName || '/move_base';
	nav2D.actionName = options.actionName || 'move_base_msgs/MoveBaseAction';
	nav2D.serverTimeout = options.serverTimeout || 5000;
	nav2D.mapTopic = options.mapTopic || '/map';
	nav2D.canvasID = options.canvasID;
	nav2D.img = options.img;
	nav2D.mapMetaTopic = options.mapMetaTopic || '/map_metadata';
	nav2D.continuous = options.continuous;

	// icon information for displaying robot and click positions
	nav2D.clickRadius = 1;
	nav2D.clickUpdate = true;
	nav2D.robotRadius = 1;
	nav2D.robotRadiusGrow = true;

	// position information
	nav2D.robotX;
	nav2D.robotY;
	nav2D.clickX;
	nav2D.clickY;

	// map and meta data
	nav2D.map;
	nav2D.mapWidth;
	nav2D.mapHeight;
	nav2D.mapResolution;
	nav2D.mapX;
	nav2D.mapY;

	nav2D.available = false;

	// grab the canvas
	nav2D.canvas = $('#' + nav2D.canvasID);

	// set the initial size of the canvas
	nav2D.canvas.attr('width', options.width);
	nav2D.canvas.attr('height', options.height);

	// check if we need to fetch a map
	if (nav2D.img) {
		// set the image
		nav2D.map = new Image();
		nav2D.map.src = nav2D.img;

		// get the meta information
		var metaListener = new nav2D.ros.Topic({
			name : nav2D.mapMetaTopic,
			messageType : 'nav_msgs/MapMetaData'
		});
		metaListener.subscribe(function(metadata) {
			// set the metadata
			nav2D.mapWidth = metadata.width;
			nav2D.mapHeight = metadata.height;
			nav2D.mapResolution = metadata.resolution;
			nav2D.mapX = metadata.origin.position.x;
			nav2D.mapY = metadata.origin.position.y;
		});
	} else {
		// create a map object
		nav2D.mapFetcher = new Map({
			ros : nav2D.ros,
			mapTopic : nav2D.mapTopic,
			continuous : nav2D.continuous
		});
		nav2D.mapFetcher.on('available', function() {
			// store the image
			nav2D.map = nav2D.mapFetcher.image;

			// set the metadata
			nav2D.mapWidth = nav2D.mapFetcher.info.width;
			nav2D.mapHeight = nav2D.mapFetcher.info.height;
			nav2D.mapResolution = nav2D.mapFetcher.info.resolution;
			nav2D.mapX = nav2D.mapFetcher.info.origin.position.x;
			nav2D.mapY = nav2D.mapFetcher.info.origin.position.y;
		});
	}

	// setup a listener for the robot pose
	var poseListener = new nav2D.ros.Topic({
		name : '/robot_pose',
		messageType : 'geometry_msgs/Pose'
	});
	poseListener
			.subscribe(function(pose) {
				// only update once we know the map metadata
				if (nav2D.mapWidth && nav2D.mapHeight && nav2D.mapResolution) {
					// get the current canvas size
					var canvasWidth = nav2D.canvas.attr('width');
					var canvasHeight = nav2D.canvas.attr('height');

					// set the pixel location with (0, 0) at the top left
					nav2D.robotX = ((pose.position.x - nav2D.mapX) / nav2D.mapResolution)
							* (canvasWidth / nav2D.mapWidth);
					nav2D.robotY = canvasHeight
							- (((pose.position.y - nav2D.mapY) / nav2D.mapResolution) * (canvasHeight / nav2D.mapHeight));

					if (!nav2D.available) {
						nav2D.available = true;
						// notify the user we are avaiable
						nav2D.emit('available');
						// set the interval for the draw function
						nav2D.interval = setInterval(nav2D.draw, 30);
					}
				}
			});

	// setup the actionlib client
	var actionClient = new ActionClient({
		ros : nav2D.ros,
		actionName : nav2D.actionName,
		serverName : nav2D.serverName,
		timeout : 5000
	});
	// pass the event up
	actionClient.on('timeout', function() {
		nav2D.emit('timeout');
	});
	
	// create a cancel
	nav2D.cancel = function() {
		actionClient.cancel();
	};

	// create the draw function
	nav2D.draw = function() {
		// grab the drawing context
		var context = nav2D.canvas[0].getContext('2d');

		// grab the current sizes
		var width = nav2D.canvas.attr('width');
		var height = nav2D.canvas.attr('height');

		// clear the canvas
		context.clearRect(0, 0, width, height);

		// check for the map
		if (nav2D.map) {
			// add the image back to the canvas
			context.drawImage(nav2D.map, 0, 0, width, height);
		}

		// check if the user clicked yet
		if (nav2D.clickX && nav2D.clickY) {
			// draw the click point
			context.fillStyle = '#543210';
			context.beginPath();
			context.arc(nav2D.clickX, nav2D.clickY, nav2D.clickRadius, 0,
					Math.PI * 2, true);
			context.closePath();
			context.fill();

			// grow half the speed of the refresh rate
			if (nav2D.clickUpdate) {
				nav2D.clickRadius++;
			}

			// reset at 5 (i.e., blink)
			if (nav2D.clickRadius == 5) {
				nav2D.clickRadius = 1;
			}

			nav2D.clickUpdate = !nav2D.clickUpdate;
		}

		// draw the robot location
		if (nav2D.robotX && nav2D.robotY) {
			// draw the click point
			context.fillStyle = '#012345';
			context.beginPath();
			context.arc(nav2D.robotX, nav2D.robotY, nav2D.robotRadius, 0,
					Math.PI * 2, true);
			context.closePath();
			context.fill();

			// grow and shrink the icon
			if (nav2D.robotRadiusGrow) {
				nav2D.robotRadius++;
			} else {
				nav2D.robotRadius--;
			}

			if (nav2D.robotRadius == 10 || nav2D.robotRadius == 1) {
				nav2D.robotRadiusGrow = !nav2D.robotRadiusGrow;
			}
		}
	};

    nav2D.getPoseFromEvent = function(e) {
				// only go if we have the map data
				if (nav2D.mapWidth > -1 && nav2D.mapHeight > -1
						&& nav2D.mapResolution > -1) {
					// get the y location with (0, 0) at the top left for
					// drawing
					nav2D.clickX = e.pageX - nav2D.canvas.offset().left;
					nav2D.clickY = e.pageY - nav2D.canvas.offset().top;

					// convert the pixel location to a pose
					var canvasWidth = nav2D.canvas.attr('width');
					var canvasHeight = nav2D.canvas.attr('height');
					var x = (nav2D.clickX * (nav2D.mapWidth / canvasWidth) * nav2D.mapResolution)
							+ nav2D.mapX;
					var y = ((canvasHeight - nav2D.clickY)
							* (nav2D.mapHeight / canvasHeight) * nav2D.mapResolution)
							+ nav2D.mapY;
                    return [x,y];
                }
                else 
                    return null;
    };

    nav2D.sendGoalPose = function(x,y) { 

					// create a goal
					var goal = new actionClient.Goal({
						target_pose : {
							header : {
								frame_id : "/map"
							},
							pose : {
								position : {
									x : x,
									y : y,
									z : 0
								},
								orientation : {
									x : 0,
									y : 0,
									z : 0.6,
									w : 0.8
								}
							}
						}
					});
					goal.send();

					// pass up the events to the user
					goal.on('result', function(result) {
						nav2D.emit('result', result);

						// clear the click icon
						nav2D.clickX = null;
						nav2D.clickY = null;
					});
					goal.on('status', function(status) {
						nav2D.emit('status', status);
					});
					goal.on('feedback', function(feedback) {
						nav2D.emit('feedback', feedback);
					});
			};

	// set the double click action
	nav2D.canvas.dblclick(function(e) {
            var poses = nav2D.getPoseFromEvent(e);
            if(poses != null) {
                nav2D.sendGoalPose(poses[0],poses[1]);
            }
            else {
                nav2D.ros.emit('error',"Error in getPoseFromEvent");
                console.log("Error");
                }
            });
};
Nav2D.prototype.__proto__ = EventEmitter2.prototype;
return Nav2D;
}
));
