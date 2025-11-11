#!/usr/bin/env python3
import math
import rclpy
from rclpy.node import Node
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
from rclpy.action import ActionClient
from geometry_msgs.msg import Twist, Point, Quaternion
from std_msgs.msg import String
from irobot_create_msgs.msg import DockStatus
from irobot_create_msgs.action import NavigateToPosition, Undock, Dock
from irobot_create_msgs.srv import ResetPose
from rclpy.executors import MultiThreadedExecutor

class NavigationNode(Node):
    """NavigationNode: beheer van navigatie, obstakels, foutstatus en automatische odometrie-reset."""

    def __init__(self):
        super().__init__('navigation_node')

        # === Parameters ===
        self.declare_parameter('linear_speed', 0.10)
        self.declare_parameter('angular_speed', 0.50)
        self.declare_parameter('avoid_linear_speed', 0.07)
        self.declare_parameter('avoid_angular_scale', 0.60)
        self.declare_parameter('achieve_goal_heading', True)

        self.linear_speed = float(self.get_parameter('linear_speed').value)
        self.angular_speed = float(self.get_parameter('angular_speed').value)
        self.avoid_linear_speed = float(self.get_parameter('avoid_linear_speed').value)
        self.avoid_angular_scale = float(self.get_parameter('avoid_angular_scale').value)
        self.achieve_goal_heading = bool(self.get_parameter('achieve_goal_heading').value)

        # === QoS ===
        qos_reliable = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )
        qos_best_effort = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )
        # === Publishers ===
        self.cmd_pub = self.create_publisher(Twist, '/cmd_vel', qos_best_effort)
        self.state_pub = self.create_publisher(String, '/navigation_state', qos_reliable)
        self.error_pub = self.create_publisher(String, '/error_status', qos_reliable)
        # === Subscriptions ===
        self.create_subscription(DockStatus, '/dock_status', self.dock_cb, qos_best_effort)
        self.create_subscription(String, '/obstacle_status', self.obstacle_cb, 10)
        self.create_subscription(Point, '/goal_position', self.goal_cb, qos_reliable)
        self.create_subscription(String, '/navigation_reset', self.reset_cb, qos_reliable)
        # === Services ===
        self.reset_pose_cli = self.create_client(ResetPose, '/reset_pose')
        # === Actions ===
        self.nav_action = ActionClient(self, NavigateToPosition, '/navigate_to_position')
        self.undock_action = ActionClient(self, Undock, '/undock')
        self.dock_action = ActionClient(self, Dock, '/dock')
        # === Interne status ===
        self.state = "STARTUP"
        self.error_status = None
        self.pose_local = {'x': 0.0, 'y': 0.0, 'yaw': 0.0}
        self.goal_xy_local = None
        self.last_status = None
        self.last_goal = None
        self.have_active_goal = False
        self.nav_goal_handle = None
        self.last_dock_status = None
        self.startup_done = False
        self.resume_on_clear = False
        # === Timers voor behavior ===
        self.startup_timer = self.create_timer(5.0, self._startup_check)
        self.long_blocked_timer = None
        self.abort_timer = None
        self.clear_timer = None
        self.obstacle_active = False

        self.publish_state()
        self.get_logger().info("NavigationNode gestart, controleer startstatus...")
    # ============================================================
    # STARTUP CONTROL
    # ============================================================
    def _startup_check(self):
        if self.last_dock_status and self.last_dock_status.is_docked:
            self.startup_timer.cancel()
            self.state = "DOCKED"
            self.publish_state()
            self.get_logger().info("Robot gedockt bij start → initialiseer undocking.")
            self._send_undock_goal()
        else:
            self.state = "WAITING_FOR_DOCK"
            self.publish_state()
            self.get_logger().warn("Robot niet gedockt bij start. Plaats robot op het dock om te starten.")
    # ============================================================
    # DOCK CALLBACK
    # ============================================================
    def dock_cb(self, msg: DockStatus):
        """Update state bij fysieke dockcontact."""
        if self.last_dock_status and msg.is_docked == self.last_dock_status.is_docked:
            return
        self.last_dock_status = msg

        if msg.is_docked:
            self.resume_on_clear = False
            self._cancel_nav_if_active()
            self._stop_motion()
            self.state = "DOCKED"
            self.publish_state()
            self.get_logger().info("Docking gedetecteerd → status DOCKED gezet.")
        else:
            self.get_logger().debug("DockStatus: robot niet gedockt")
    # ============================================================
    # EXTERNE RESET CALLBACK
    # ============================================================
    def reset_cb(self, msg: String):
        cmd = msg.data.strip().lower()
        if cmd != "reset":
            self.get_logger().warn(f"Onbekend reset-commando: '{cmd}' genegeerd.")
            return
        
        self.resume_on_clear = False
        self._cancel_nav_if_active()
        self._stop_motion()
        self.error_status = None
        self._cancel_behavior_timers()

        if self.state == "NAV_ABORTED":
            self.state = "IDLE"
            self.publish_state()
            self.get_logger().info("Extern reset uitgevoerd → NAV_ABORTED opgeheven en status IDLE gezet.")
        else:
            self.publish_state()
            self.get_logger().info(f"Extern reset uitgevoerd (status bleef {self.state}).")
    # ============================================================
    # GOAL CALLBACK
    # ============================================================
    def goal_cb(self, msg: Point):
        if self.state in ("WAITING_FOR_DOCK", "DOCKING"):
            self.get_logger().warn("Robot is niet klaar om te navigeren (wachtend of aan het docken).")
            return
        # === Speciale DOCK-opdracht ===
        if abs(msg.x) < 0.01 and abs(msg.y) < 0.01:
            self.get_logger().info("Doel (0,0,0) ontvangen → voer automatische dock-procedure uit.")
            pre_dock_x, pre_dock_y = 0.3, 0.0
            self.goal_xy_local = (pre_dock_x, pre_dock_y)
            self.last_goal = self.goal_xy_local
            self.pending_dock_after_nav = True
            self._send_navigate_goal()
            return
        # === Normale navigatie ===
        self.goal_xy_local = (msg.x, msg.y)
        self.last_goal = self.goal_xy_local
        self.get_logger().info(f"Nieuw doel ontvangen: ({msg.x:.2f}, {msg.y:.2f})")

        if self.state in ("UNDOCKED", "IDLE"):
            self._send_navigate_goal()
        elif self.state == "DOCKED":
            self.get_logger().info("Robot is gedockt → voer eerst undock-procedure uit.")
            self._send_undock_goal()
        else:
            self.get_logger().warn(f"Navigatie niet toegestaan in huidige status: {self.state}")
    # ============================================================
    # OBSTACLE CALLBACK
    # ============================================================
    def obstacle_cb(self, msg: String):
        status = msg.data

        # Dock- of undockfase: negeren
        if self.state in ("WAITING_FOR_DOCK", "UNDOCKING", "DOCKING"):
            return

        # === Pad vrij ===
        if status == "clear":
            if not self.obstacle_active:
                # Als robot al vrij was → negeren
                return
            self.state = "CLEAR"
            self.last_status = None
            self.get_logger().info("Pad vrij → start clear-timer (2s).")
            self._start_clear_timer()
            return

        # === Obstakel aanwezig ===
        if not self.obstacle_active:
            self.get_logger().info("Nieuw obstakel gedetecteerd.")
            
        # Update state afhankelijk van richting
        # --- Geblokkeerd: stop motoren ---
        if status == "blocked":
            self.state = "BLOCKED"
            self.last_status = "BLOCKED"
            self._pauze_nav_if_active()
            self.publish_state()
            self._start_obstacle_timers()
            self.obstacle_active = True
            if self.clear_timer != None:
                self.clear_timer.cancel()
                self.clear_timer = None            
            self.get_logger().info("start behavior timers (5s/30s).")
        elif status == "obstacle_left":
            self.state = "AVOIDING_LEFT"
            self._pauze_nav_if_active()
            self.publish_state()
            self._start_obstacle_timers()
            self.obstacle_active = True
            if self.clear_timer != None:
                self.clear_timer.cancel()
                self.clear_timer = None
            self.get_logger().info("start behavior timers (5s/30s).")
        elif status == "obstacle_right":
            self.state = "AVOIDING_RIGHT"
            self._pauze_nav_if_active()
            self.publish_state()
            self._start_obstacle_timers()
            self.obstacle_active = True
            if self.clear_timer != None:
                self.clear_timer.cancel()
                self.clear_timer = None
            self.get_logger().info("start behavior timers (5s/30s).")

    # ============================================================
    # TIMER CALLBACKS
    # ============================================================
    def _start_obstacle_timers(self):
        """Start timers voor langdurige blokkade en navigatie-abort, als ze nog niet actief zijn."""
        if not self.long_blocked_timer:
            self.long_blocked_timer = self.create_timer(5.0, self._on_long_blocked)
            self.get_logger().info("5s LONG_BLOCKED-timer gestart.")
        else:
            self.get_logger().info("LONG_BLOCKED-timer bestaat al, niet opnieuw gestart.")

        if not self.abort_timer:
            self.abort_timer = self.create_timer(30.0, self._on_nav_abort)
            self.get_logger().info("30s NAV_ABORT-timer gestart.")
        else:
            self.get_logger().info("NAV_ABORT-timer bestaat al, niet opnieuw gestart.")


    def _start_clear_timer(self):
        """Start de clear-timer (2s) alleen als er nog geen actieve bestaat."""
        if not self.clear_timer:
            self.clear_timer = self.create_timer(2.0, self._on_clear_done)
            self.get_logger().info("2s CLEAR-timer gestart.")
        else:
            self.get_logger().info("CLEAR-timer bestaat al, niet opnieuw gestart.")

    def _cancel_behavior_timers(self):
        if self.long_blocked_timer != None:
            self.long_blocked_timer.cancel()
            self.long_blocked_timer = None
        if self.abort_timer != None:
            self.abort_timer.cancel()
            self.abort_timer = None
        if self.clear_timer != None:
            self.clear_timer.cancel()
            self.clear_timer = None

    def _on_long_blocked(self):
        if self.obstacle_active and self.error_status != "LONG_BLOCKED":
            self.error_status = "LONG_BLOCKED"
            self.get_logger().warn("Robot te lang geblokkeerd (5s) → LONG_BLOCKED.")
            self.publish_state()
        if self.long_blocked_timer:
            self.long_blocked_timer.cancel()
            self.long_blocked_timer = None

    def _on_nav_abort(self):
        if self.obstacle_active:
            self.resume_on_clear = False
            self._cancel_nav_if_active()
            self._stop_motion()
            self.state = "NAV_ABORTED"
            self.error_status = "OBSTACLE_TIMEOUT"
            self.get_logger().error("Obstakel >30s aanwezig → navigatie afgebroken.")
            self.publish_state()
        if self.abort_timer:
            self.abort_timer.cancel()
            self.abort_timer = None

    def _on_clear_done(self):
        self.state = "IDLE"
        self.obstacle_active = False
        self.error_status = None
        self.publish_state()
        self._cancel_behavior_timers()
        self.get_logger().info("Nieuw obstakel ontweken.")
        
        if self.resume_on_clear and self.goal_xy_local and not self.have_active_goal:
            self.get_logger().info("Pad vrij → hervat navigatie naar laatst bekende doel.")
            self._send_navigate_goal()
            self.resume_on_clear = False
        
    # ============================================================
    # DOCK / TERUGKEREN NAAR BASIS
    # ============================================================
    def _send_dock_goal(self):
        """Start de automatische dock-actie."""
        if not self.dock_action.wait_for_server(timeout_sec=4.0):
            self.get_logger().warn("Dock action server niet beschikbaar.")
            return

        self.state = "DOCKING"
        self.publish_state()
        goal = Dock.Goal()
        self.get_logger().info("Verstuur dock-goal...")

        future = self.dock_action.send_goal_async(goal)
        future.add_done_callback(self._on_dock_goal_sent)

    def _on_dock_goal_sent(self, future):
        """Callback zodra de dock-goal is verzonden."""
        goal_handle = future.result()
        if not goal_handle or not goal_handle.accepted:
            self.state = "IDLE"
            self.publish_state()
            self.get_logger().warn("Dock-goal niet geaccepteerd.")
            return
        self.get_logger().info("Dock-goal geaccepteerd door server.")
        goal_handle.get_result_async().add_done_callback(self._on_dock_completed)

    def _on_dock_completed(self, future):
        """Callback zodra de dock-actie is voltooid."""
        result = future.result()

        if result and hasattr(result, "result"):
            # ✅ Dock geslaagd
            self.get_logger().info("Dock-actie succesvol afgerond.")

            #Stop timers (alleen control_loop; blokkadecontrole is event-based)
            self.control_timer.cancel()
            self.control_timer = None
            self._cancel_behavior_timers()

            self.state = "DOCKED"
            self.publish_state()
            self.get_logger().info("Robot is succesvol gedockt en staat in ruststand.")
        else:
            # Dock mislukt of onduidelijk
            self.get_logger().warn("Dock-resultaat onbekend of mislukt. Robot blijft actief.")
            if self.state != "NAV_ABORTED":
                self.state = "IDLE"
                self.publish_state()
                self.get_logger().info("Status teruggezet naar IDLE voor herpoging of inspectie.")

    # ============================================================
    # UNDOCK / RESET POSE
    # ============================================================
    def _send_undock_goal(self):
        if not self.undock_action.wait_for_server(timeout_sec=5.0):
            self.get_logger().warn("Undock action server niet beschikbaar.")
            return
        self.state = "UNDOCKING"
        self.publish_state()
        goal = Undock.Goal()
        self.get_logger().info("Verstuur undock-goal...")
        future = self.undock_action.send_goal_async(goal)
        future.add_done_callback(self._on_undock_goal_sent)

    def _on_undock_goal_sent(self, future):
        goal_handle = future.result()
        if not goal_handle or not goal_handle.accepted:
            self.state = "DOCKED"
            self.publish_state()
            self.get_logger().warn("Undock-goal niet geaccepteerd.")
            return
        goal_handle.get_result_async().add_done_callback(self._on_undock_completed)

    def _on_undock_completed(self, future):
        """Wordt aangeroepen zodra undock succesvol is afgerond."""
        _ = future.result()
        self._reset_pose(0.0, 0.0, 0.0)

        # Reset gedrag en timers
        self.error_status = None
        self.obstacle_active = False
        self._cancel_behavior_timers()

        # Start control-loop opnieuw
        self.control_timer = self.create_timer(0.1, self.control_loop)
        self.get_logger().info("Control-loop gestart (robot actief en gereed om te navigeren).")

        # State en logging
        self.state = "UNDOCKED"
        self.publish_state()
        self.get_logger().info("Undocked: robot vrij om te navigeren.")


    def _reset_pose(self, x=0.0, y=0.0, yaw=0.0):
        """Reset odometrie via /reset_pose en zet state UNDOCKED zodra klaar."""
        if not self.reset_pose_cli.wait_for_service(timeout_sec=2.0):
            self.get_logger().warn("/reset_pose service not available.")
            return

        q = Quaternion()
        q.x = 0.0
        q.y = 0.0
        q.z = math.sin(yaw / 2.0)
        q.w = math.cos(yaw / 2.0)

        req = ResetPose.Request()
        req.pose.position.x = float(x)
        req.pose.position.y = float(y)
        req.pose.position.z = 0.0
        req.pose.orientation = q

        future = self.reset_pose_cli.call_async(req)

        def _after_reset(_):
            self.state = "UNDOCKED"
            self.publish_state()
            self.get_logger().info(f"Odometry pose reset → robot is UNDOCKED ({x:.2f}, {y:.2f}, yaw={yaw:.2f}).")

        future.add_done_callback(_after_reset)
    # ============================================================
    # NAVIGATIE
    # ============================================================
    def _send_navigate_goal(self):
        if not self.goal_xy_local:
            self.get_logger().warn("Geen doel beschikbaar.")
            return
        if not self.nav_action.wait_for_server(timeout_sec=5.0):
            self.get_logger().warn("NavigateToPosition server niet beschikbaar.")
            return

        gx, gy = self.goal_xy_local  # directe coördinaten in odom
        goal = NavigateToPosition.Goal()
        goal.achieve_goal_heading = self.achieve_goal_heading
        goal.goal_pose.header.frame_id = "odom"
        goal.goal_pose.pose.position.x = gx
        goal.goal_pose.pose.position.y = gy
        goal.goal_pose.pose.orientation.w = 1.0

        self.last_goal = self.goal_xy_local
        self.get_logger().info(f"Verstuur navigatie-doel: ({gx:.2f}, {gy:.2f})")
        future = self.nav_action.send_goal_async(goal)
        future.add_done_callback(self._on_nav_goal_sent)
        self.state = "MOVING"
        self.publish_state()

    def _on_nav_goal_sent(self, future):
        goal_handle = future.result()
        if not goal_handle or not goal_handle.accepted:
            self.state = "IDLE"
            self.publish_state()
            return
        self.nav_goal_handle = goal_handle
        self.have_active_goal = True
        goal_handle.get_result_async().add_done_callback(self._on_nav_result)

    def _on_nav_result(self, future):
        self.have_active_goal = False
        self.nav_goal_handle = None
        if self.state == "MOVING":
            self.get_logger().info("Navigatie afgerond.")
            self.state = "IDLE"
            self.publish_state()
            # ✅ Controleer of er een automatische dock gepland is
        if hasattr(self, "pending_dock_after_nav") and self.pending_dock_after_nav:
            self.pending_dock_after_nav = False
            self.get_logger().info("Pre-dock navigatie voltooid → start dock-procedure.")
            self._send_dock_goal()
    # ============================================================
    # CONTROL
    # ============================================================
    def control_loop(self):
        """Reageer op de huidige state: ontwijk, blokkeer"""
        twist = Twist()
        if self.state == "CLEAR":
            self._stop_motion()

        # --- Ontwijkgedrag ---
        elif self.state == "AVOIDING_LEFT":
            twist.linear.x = self.avoid_linear_speed
            twist.angular.z = -self.angular_speed * self.avoid_angular_scale
            self.cmd_pub.publish(twist)

        elif self.state == "AVOIDING_RIGHT":
            twist.linear.x = self.avoid_linear_speed
            twist.angular.z = self.angular_speed * self.avoid_angular_scale
            self.cmd_pub.publish(twist)
        
    # ============================================================
    # UTILITIES
    # ============================================================
    def _stop_motion(self):
        self.cmd_pub.publish(Twist())

    def _cancel_nav_if_active(self):
        if self.have_active_goal and self.nav_goal_handle:
            try:
                self.nav_goal_handle.cancel_goal_async()
                self.get_logger().info("Actieve navigate-goal geannuleerd.")
            except Exception:
                pass
            self.have_active_goal = False
            self.nav_goal_handle = None

    def _pauze_nav_if_active(self):
        if self.have_active_goal and self.nav_goal_handle:
            try:
                self.nav_goal_handle.cancel_goal_async()
                self.get_logger().info("Actieve navigate-goal geannuleerd (pauze).")
            except Exception:
                pass
        # expliciet aangeven dat er nu geen actief goal meer is
        self.have_active_goal = False
        self.nav_goal_handle = None
        self.resume_on_clear = True
        self._stop_motion()

    def publish_state(self):
        self.state_pub.publish(String(data=self.state or ""))
        self.error_pub.publish(String(data=self.error_status or ""))

    @staticmethod
    def _yaw_from_quat(x, y, z, w):
        siny_cosp = 2.0 * (w * z + x * y)
        cosy_cosp = 1.0 - 2.0 * (y * y + z * z)
        return math.atan2(siny_cosp, cosy_cosp)

def main(args=None):
    rclpy.init(args=args)
    node = NavigationNode()
    executor = MultiThreadedExecutor(num_threads=4)
    executor.add_node(node)
    try:
        executor.spin()
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()

if __name__ == '__main__':
    main()

