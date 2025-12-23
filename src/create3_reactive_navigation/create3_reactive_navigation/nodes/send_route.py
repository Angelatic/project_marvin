#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Point
from std_msgs.msg import String
import time


class RouteCommander(Node):
    """
    Stuurt een reeks waypoints naar /goal_position.
    Wacht na ieder doel tot de NavigationNode state weer 'IDLE' is
    voordat het volgende waypoint wordt verzonden.
    """

    def __init__(self):
        super().__init__('route_commander')

        # Publisher naar jouw NavigationNode
        self.goal_pub = self.create_publisher(Point, '/goal_position', 10)

        # Subscriben op navigatiestatus
        self.state_sub = self.create_subscription(String, '/navigation_state', self.state_cb, 10)

        self.current_state = None
        self.last_state = None
        self.state_change_time = time.time()

        # === definieer hier je route (in meters, lokaal t.o.v. oorsprong) ===
        self.route = [
            (-10.0, -0.5),
            (-13.0, 0.0),
            (-13.0, 6.5),
            (-5.0, 6.5)
        ]

        self.route_index = 0
        self.executing = False
        self.timer = self.create_timer(0.5, self.route_loop)

        self.get_logger().info("RouteCommander gestart. Wacht tot NavigationNode 'IDLE' is...")

    # -------------------------------------------------------------
    # Callbacks
    # -------------------------------------------------------------
    def state_cb(self, msg: String):
        self.last_state = self.current_state
        self.current_state = msg.data

        if self.last_state != self.current_state:
            self.get_logger().info(f"Navigation state: {self.current_state}")
            self.state_change_time = time.time()

    # -------------------------------------------------------------
    # Periodieke loop
    # -------------------------------------------------------------
    def route_loop(self):
        # Wacht tot navigation node klaar is
        if self.current_state not in ("IDLE", "UNDOCKED"):
            return

        # Als er nog waypoints over zijn en we niet al iets sturen
        if not self.executing and self.route_index < len(self.route):
            x, y = self.route[self.route_index]
            self._send_goal(x, y)
            self.executing = True

        # Check of de huidige navigatie afgerond is
        elif self.executing and self.current_state == "IDLE":
            # korte zekerheidspauze
            if time.time() - self.state_change_time > 1.0:
                self.route_index += 1
                self.executing = False

                if self.route_index >= len(self.route):
                    self.get_logger().info("Route volledig afgerond ✅")
                    rclpy.shutdown()

    # -------------------------------------------------------------
    # Hulpmethode
    # -------------------------------------------------------------
    def _send_goal(self, x: float, y: float):
        msg = Point()
        msg.x = x
        msg.y = y
        msg.z = 0.0
        self.goal_pub.publish(msg)
        self.get_logger().info(f"Nieuw doel verzonden: ({x:.2f}, {y:.2f})")


def main(args=None):
    rclpy.init(args=args)
    node = RouteCommander()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()

