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
 *  Version: October 8, 2012
 *  
 *  Converted to AMD by Jihoon Lee
 *  Version: September 27, 2012
 *
 *********************************************************************/

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([ 'eventemitter2', 'actionclient', 'map' ], factory);
  } else {
    root.Nav2D = factory(root.EventEmitter2, root.ActionClient, root.Map);
  }
}
    (
        this,
        function(EventEmitter2, ActionClient, Map) {
          var Nav2D = function(options) {
            var nav2D = this;
            options = options || {};
            nav2D.ros = options.ros;
            nav2D.serverName = options.serverName || '/move_base';
            nav2D.actionName = options.actionName
                || 'move_base_msgs/MoveBaseAction';
            nav2D.serverTimeout = options.serverTimeout || 5000;
            nav2D.mapTopic = options.mapTopic || '/map';
            nav2D.continuous = options.continuous;
            nav2D.canvasID = options.canvasID;
            // optional (used if you do not want to stream /map or use a custom image)
            nav2D.image = options.image;
            nav2D.mapMetaTopic = options.mapMetaTopic || '/map_metadata';
            // optional color settings
            nav2D.clickColor = options.clickColor || '#543210';
            nav2D.robotColor = options.robotColor || '#012345';
            nav2D.initialPoseTopic = options.initialPoseTopic || '/initialpose';

            // draw robot 
            nav2D.drawrobot = options.drawrobot;
            
            nav2D.mode = 'none';
            
            // current robot pose message
            nav2D.robotPose = null;
            // current goal
            nav2D.goalMessage = null;

            // icon information for displaying robot and click positions
            var clickRadius = 1;
            var clickUpdate = true;
            var maxClickRadius = 5;
            var robotRadius = 1;
            var robotRadiusGrow = true;
            var maxRobotRadius = 10;

            // position information
            var robotX;
            var robotY;
            var robotRotZ;
            var clickX;
            var clickY;

            // map and metadata
            var map;
            var mapWidth;
            var mapHeight;
            var mapResolution;
            var mapX;
            var mapY;
            var drawInterval;

            // flag to see if everything (map image, metadata, and robot pose) is available
            var available = false;

            // grab the canvas
            var canvas = document.getElementById(nav2D.canvasID);

            // check if we need to fetch a map or if an image was provided
            if (nav2D.image) {
              // set the image
              map = new Image();
              map.src = nav2D.image;

              // get the meta information
              var metaListener = new nav2D.ros.Topic({
                name : nav2D.mapMetaTopic,
                messageType : 'nav_msgs/MapMetaData'
              });
              metaListener.subscribe(function(metadata) {
                // set the metadata
                mapWidth = metadata.width;
                mapHeight = metadata.height;
                mapResolution = metadata.resolution;
                mapX = metadata.origin.position.x;
                mapY = metadata.origin.position.y;

                // we only need the metadata once
                metaListener.unsubscribe();
              });
            } else {
              // create a map object
              var mapFetcher = new Map({
                ros : nav2D.ros,
                mapTopic : nav2D.mapTopic,
                continuous : nav2D.continuous
              });
              mapFetcher.on('available', function() {
                // store the image
                map = mapFetcher.image;

                // set the metadata
                mapWidth = mapFetcher.info.width;
                mapHeight = mapFetcher.info.height;
                mapResolution = mapFetcher.info.resolution;
                mapX = mapFetcher.info.origin.position.x;
                mapY = mapFetcher.info.origin.position.y;
              });
            }

            // setup a listener for the robot pose
            var poseListener = new nav2D.ros.Topic({
              name : '/robot_pose',
              messageType : 'geometry_msgs/Pose',
              throttle_rate : 100,
            });
            poseListener
                .subscribe(function(pose) {
                  // set the public field
                  nav2D.robotPose = pose;
                  
                  // only update once we know the map metadata
                  if (mapWidth && mapHeight && mapResolution) {
                    // get the current canvas size
                    var canvasWidth = canvas.getAttribute('width');
                    var canvasHeight = canvas.getAttribute('height');

                    // set the pixel location with (0, 0) at the top left
                    robotX = ((pose.position.x - mapX) / mapResolution)
                        * (canvasWidth / mapWidth);
                    robotY = canvasHeight
                        - (((pose.position.y - mapY) / mapResolution) * (canvasHeight / mapHeight));

                    // get the rotation Z
                    var q0 = pose.orientation.w;
                    var q1 = pose.orientation.x;
                    var q2 = pose.orientation.y;
                    var q3 = pose.orientation.z;
                    
                    robotRotZ = -Math.atan2(2 * ( q0 * q3 + q1 * q2) , 1 - 2 * (Math.pow(q2,2) +Math.pow(q3,2)));

                    // check if this is the first time we have all information
                    if (!available) {
                      available = true;
                      // notify the user we are available
                      nav2D.emit('available');
                      // set the interval for the draw function
                      drawInterval = setInterval(draw, 30);
                    }
                  }
                });

            // setup the actionlib client
            var actionClient = new ActionClient({
              ros : nav2D.ros,
              actionName : nav2D.actionName,
              serverName : nav2D.serverName,
              timeout : nav2D.serverTimeout
            });
            // pass the event up
            actionClient.on('timeout', function() {
              nav2D.emit('timeout');
            });

            // create a cancel
            nav2D.cancel = function() {
              actionClient.cancel();
            };

            var robotIcon = new Image();
            robotIcon.src ="data:image/png;base64,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";
            // robots
            var robotsize = 23;
            var robotinc = 0.1;

            nav2D.drawrobot = nav2D.drawrobot || function(context,robotX,robotY,robotRotZ) {
              context.save();
              context.translate(robotX,robotY);
              context.rotate(robotRotZ);
              context.drawImage(robotIcon,0,0,robotsize,robotsize);

              if(robotsize >= 30)
                robotinc = -0.3;
              else if(robotsize <= 25)
                robotinc = 0.3;

              robotsize += robotinc;
              context.restore();
            };

            nav2D.drawgoal = function(context)
            {
              /*
              var angle;

              if(nav2D.mode == 'inset') {
                if(clickZX == clickX)
                  angle = 0;
                else
                  angle = (clickZY - clickY) / (clickZX-clickX);
              }
              else if(nav2D.mode == 'moving')
              {
              }

              nav2D.drawtriangle();
              context.save();
              context.translate(clickX,clickY);
              context.rotate(angle);
              context.lineTo(-20,20);
              context.restore();
            }
*/
              // check if the user clicked yet
              if (clickX && clickY && nav2D.mode == 'none') {
                // draw the click point
                context.fillStyle = nav2D.clickColor;
                context.beginPath();
                context.arc(clickX, clickY, clickRadius, 0, Math.PI * 2,true);
                context.closePath();
                context.fill();

                // grow half the speed of the refresh rate
                if (clickUpdate) {
                  clickRadius++;
                }

                // reset at the threshold (i.e., blink)
                if (clickRadius == maxClickRadius) {
                  clickRadius = 1;
                }

                clickUpdate = !clickUpdate;
              }
            };

            // create the draw function
            var draw = function() {
              // grab the drawing context
              var context = canvas.getContext('2d');

              // grab the current sizes
              var width = canvas.getAttribute('width');
              var height = canvas.getAttribute('height');

              // add the image back to the canvas
              context.drawImage(map, 0, 0, width, height);

              // draw Goal
              nav2D.drawgoal(context);

              // draw the robot location
              nav2D.drawrobot(context,robotX,robotY,robotRotZ);
            };

            // get the position in the world from a point clicked by the user
            nav2D.getPoseFromEvent = function(event) {
              // only go if we have the map data
              if (available) {
                // get the y location with (0, 0) at the top left
                var offsetLeft = 0;
                var offsetTop = 0;
                var element = canvas;
                var offX;
                var offY;
                while (element && !isNaN(element.offsetLeft)
                    && !isNaN(element.offsetTop)) {
                  offsetLeft += element.offsetLeft - element.scrollLeft;
                  offsetTop += element.offsetTop - element.scrollTop;
                  element = element.offsetParent;
                }
                offX = event.pageX - offsetLeft;
                offY = event.pageY - offsetTop;

                // convert the pixel location to a pose
                var canvasWidth = canvas.getAttribute('width');
                var canvasHeight = canvas.getAttribute('height');
                var x = (offX * (mapWidth / canvasWidth) * mapResolution)
                    + mapX;
                var y = ((canvasHeight - offY) * (mapHeight / canvasHeight) * mapResolution)
                    + mapY;
                return [ x, y , offX,offY];
              } else {
                return null;
              }
            };

            // a function to send the robot to the given goal location
            nav2D.sendGoalPose = function(x, y) {
              // create a goal
              var goal = new actionClient.Goal({
                target_pose : {
                  header : {
                    frame_id : '/map'
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
              
              nav2D.goalMessage = goal.goalMessage;

              // pass up the events to the user
              goal.on('result', function(result) {
                nav2D.emit('result', result);
                nav2D.mode = 'none';

                // clear the click icon
                clickX = null;
                clickY = null;
              });
              goal.on('status', function(status) {
                nav2D.emit('status', status);
              });
              goal.on('feedback', function(feedback) {
                nav2D.emit('feedback', feedback);
              });
            };
/*
            nav2D.ismousedown = false;
           canvas.addEventListener('mousedown',function(event) {
              var poses = nav2D.getPoseFromEvent(event);

              goalX = poses[0];
              goalY = poses[1];
              clickX = clickZX = poses[2];
              clickY = clickZY = poses[3];

//              nav2D.ismousedown = true;
              nav2D.mode = 'inset';
             });

           canvas.addEventListener('mousemove',function(event) {
               if(nav2D.ismousedown) {
               console.log(event);
               var poses = nav2D.getPoseFromEvent(event);
               clickZX = poses[0];
               clickZY = poses[1];
               }
             });

           canvas.addEventListener('mouseup',function(event) {
              var poses = nav2D.getPoseFromEvent(event);
              goalZX = poses[0];
              goalZY = poses[1];
              clickZX = poses[0];
              clickZY = poses[1];
              nav2D.ismousedown = false;
              nav2D.sendGoalPose(goalX, goalY);
              nav2D.mode = 'moving';
            });

           */

           canvas.addEventListener('click',function(event) {
             if(nav2D.mode == 'none') {           }
             else if(nav2D.mode == 'init') 
             {
               var poses = nav2D.getPoseFromEvent(event);
               clickX = poses[2];
               clickY = poses[3];
               if (poses != null) {
                 nav2D.sendInitPose(poses[0], poses[1]);
               } else {
                 nav2D.emit('error',"All of the necessary navigation information is not yet available."); 
               }
             }
             else if(nav2D.mode == 'goal') {
               var poses = nav2D.getPoseFromEvent(event);
               if (poses != null) {
                 clickX = poses[2];
                 clickY = poses[3];

                 nav2D.sendGoalPose(poses[0], poses[1]);
               } else {
                 nav2D.emit('error',"All of the necessary navigation information is not yet available.");
               }
             }
             else {
               nav2D.emit('error',"Wrong mode..");
             }
             nav2D.mode = 'none';
            });

            nav2D.setmode = function(mode) {
              nav2D.mode = mode;
              clickX = null;
              clickY = null;
            };

            nav2D.initPosePub = new nav2D.ros.Topic({
              name : nav2D.initialPoseTopic,
              type : 'geometry_msgs/PoseWithCovarianceStamped',
            });

            nav2D.sendInitPose = function(x,y) {
              var pose_msg = new ros.Message({
                header : {
                    frame_id : '/map'
                },
                pose : {
                  pose : {
                    position: {
                      x : x,
                      y : y,
                      z : 0,
                    },
                    orientation : {
                      x : 0,
                      y : 0,
                      z : 0,
                      w : 1,
                    },
                  },
                  covariance: [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
                },
              });
              nav2D.initPosePub.publish(pose_msg);
              nav2D.setmode('none');
            };

            canvas
                .addEventListener(
                    'dblclick',
                    function(event) {
                      var poses = nav2D.getPoseFromEvent(event);
                      if (poses != null) {
                        nav2D.sendGoalPose(poses[0], poses[1]);
                      } else {
                        nav2D
                            .emit('error',
                                "All of the necessary navigation information is not yet available.");
                      }
                    });
          };
          Nav2D.prototype.__proto__ = EventEmitter2.prototype;
          return Nav2D;
        }));
