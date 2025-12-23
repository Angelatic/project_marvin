import rclpy
from rclpy.node import Node
from rclpy.qos import QoSPresetProfiles
from std_msgs.msg import String
from irobot_create_msgs.msg import IrIntensityVector, HazardDetectionVector
from rclpy.parameter import Parameter
from rcl_interfaces.msg import SetParametersResult


class ObstacleAvoidanceNode(Node):
    """Node die IR-sensoren en bumpers uitleest en een obstakelstatus publiceert."""

    def __init__(self):
        super().__init__('obstacle_avoidance_node')
        self.get_logger().info('ObstacleAvoidanceNode gestart.')

        # === Parameters ===
        self.declare_parameter('proximity_threshold', 400)
        self.proximity_threshold = self.get_parameter('proximity_threshold').value
        self.get_logger().info(f'Gebruik proximity_threshold = {self.proximity_threshold}')

        # Zorg dat live aanpassing mogelijk is
        self.add_on_set_parameters_callback(self.parameter_callback)

        # === Publisher en subscribers ===
        self.status_pub = self.create_publisher(String, '/obstacle_status', 10)

        # Gebruik hetzelfde QoS-profiel als de Create 3-sensortopics
        sensor_qos = QoSPresetProfiles.SENSOR_DATA.value

        self.ir_sub = self.create_subscription(
            IrIntensityVector,
            '/ir_intensity',
            self.ir_callback,
            sensor_qos
        )

        self.hazard_sub = self.create_subscription(
            HazardDetectionVector,
            '/hazard_detection',
            self.hazard_callback,
            sensor_qos
        )

        self.last_status = "clear"

    # === Callbacks ===
    def ir_callback(self, msg: IrIntensityVector):
        """Verwerk IR-sensorwaarden om richting van obstakel te bepalen."""
        readings = [r.value for r in msg.readings]
        left_side = readings[0:3]
        right_side = readings[4:7]
        center = readings[3] if len(readings) > 3 else 0

        left_max = max(left_side)
        right_max = max(right_side)
        threshold = self.proximity_threshold
        new_status = "clear"

        if center > threshold or (left_max > threshold and right_max > threshold):
            new_status = "blocked"
        elif left_max > threshold:
            new_status = "obstacle_left"
        elif right_max > threshold:
            new_status = "obstacle_right"

        if new_status != self.last_status:
            self.last_status = new_status
            msg_out = String()
            msg_out.data = new_status
            self.status_pub.publish(msg_out)
            self.get_logger().info(
                f"Obstacle status: {new_status} (L={left_max}, C={center}, R={right_max}, thr={threshold})"
            )

    def hazard_callback(self, msg: HazardDetectionVector):
        """Controleer bumpers – directe blokkade bij contact of gevaar."""
        hazard_triggered = False

        for detection in msg.detections:
            hazard_type = detection.type
            frame = detection.header.frame_id

            # Log alle detecties voor debug
            self.get_logger().debug(f"Hazard ontvangen: type={hazard_type}, frame={frame}")

            # Constants uit irobot_create_msgs/msg/HazardDetection.msg
            BACKUP_LIMIT = 0
            BUMP = 1
            CLIFF = 2
            STALL = 3
            WHEEL_DROP = 4
            OBJECT_PROXIMITY = 5

            # Bumper of andere fysieke gevaren activeren blokkade
            if hazard_type in (BUMP, CLIFF, STALL, WHEEL_DROP, OBJECT_PROXIMITY):
                hazard_triggered = True
                self.get_logger().warn(
                    f"Hazard gedetecteerd: type={hazard_type} ({frame}) → blokkade geactiveerd."
                )

        if hazard_triggered:
            msg_out = String()
            msg_out.data = "blocked"
            self.status_pub.publish(msg_out)
            self.last_status = "blocked"

    def parameter_callback(self, params):
        """Laat live aanpassen van de proximity_threshold toe."""
        for p in params:
            if p.name == 'proximity_threshold' and p.type_ == Parameter.Type.INTEGER:
                self.proximity_threshold = p.value
                self.get_logger().info(f'Nieuwe proximity_threshold ingesteld op {p.value}')
        return SetParametersResult(successful=True)


def main(args=None):
    rclpy.init(args=args)
    node = ObstacleAvoidanceNode()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()

