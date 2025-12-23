#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from std_msgs.msg import String
from irobot_create_msgs.msg import LightringLeds, LedColor
from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy


class BehaviorManager(Node):
    """Geeft visuele feedback via de LED-ring op basis van navigatie- en foutstatus."""

    def __init__(self):
        super().__init__('behavior_manager')
        self.get_logger().info("BehaviorManager gestart.")

        # Huidige toestand
        self.state = "IDLE"
        self.error = None
        self.led_on = True  # voor knipperlogica
        self.active_color = (160,40,123)

        # === QoS ===
        qos_reliable = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=10
        )

        # Publishers & Subscribers
        self.led_pub = self.create_publisher(LightringLeds, '/cmd_lightring', 10)
        self.create_subscription(String, '/navigation_state', self.state_cb, qos_reliable)
        self.create_subscription(String, '/error_status', self.error_cb, qos_reliable)

        # Timers
        self.blink_timer = self.create_timer(0.5, self._blink_timer_cb)  # standaard 2 Hz
        self.persist_timer = self.create_timer(5.0, self._persist_timer_cb)

        # Kleurconfiguratie
        self.color_map = {
            "DOCKED": (0, 0, 255),             # blauw
            "UNDOCKING": (255, 255, 0),        # geel
            "MOVING": (0, 255, 0),             # groen
            "AVOIDING_LEFT": (255, 165, 0),    # oranje
            "AVOIDING_RIGHT": (255, 165, 0),   # oranje
            "BLOCKED": (255, 0, 0),            # rood
            "LONG_BLOCKED": (255, 0, 0),       # rood
            "NAV_ABORTED": (128, 0, 128),      # paars
            "IDLE": (255, 255, 255),           # wit
            "UNDOCKED": (255, 255, 255)        # wit
        }

        # Knipper- en dubbelknipperinstellingen (state → frequentie in seconden)
        self.blink_modes = {
            "UNDOCKING": 1.0,
            "AVOIDING_LEFT": 0.25,
            "AVOIDING_RIGHT": 0.25,
            "BLOCKED": 1.0,
            "LONG_BLOCKED": 0.25,
            "NAV_ABORTED": 0.4,  # dubbelknipper
        }

    # ============================================================
    # CALLBACKS
    # ============================================================
    def state_cb(self, msg: String):
        if msg.data != self.state:
            self.state = msg.data if msg.data else None
            self.get_logger().info(f"Nieuwe navigatiestatus: {msg.data}")
            self.state = msg.data
            self.update_led_behavior()

    def error_cb(self, msg: String):
        if msg.data != self.error:
            self.error = msg.data if msg.data else None
            self.get_logger().warn(f"Nieuwe foutstatus: {msg.data}")
            self.update_led_behavior()

    # ============================================================
    # LED-UPDATES
    # ============================================================
    def update_led_behavior(self):
        """Bepaal gewenste kleur en knippergedrag op basis van state en error."""
        # Bepaal prioriteit: errors overschrijven state
        active_state = self.error if self.error else self.state
        if not active_state:
            active_state = "IDLE"

        color = self.color_map.get(active_state, (0, 0, 255))
        self.active_color = color

        # Pas blink-interval aan (of zet vast)
        blink_interval = self.blink_modes.get(active_state)
        if blink_interval:
            self.blink_timer.timer_period_ns = int(blink_interval * 1e9)
        else:
            self.blink_timer.timer_period_ns = int(2.0 * 1e9)
            self.led_on = True  # vast aan

        self._publish_color(color if self.led_on else (0, 0, 0))

    def _blink_timer_cb(self):
        """Regelt knippergedrag afhankelijk van huidige status."""
        active_state = self.error if self.error else self.state
        if active_state in self.blink_modes:
            # Wissel LED-status
            self.led_on = not self.led_on
            # Dubbelknipper (NAV_ABORTED)
            if active_state == "NAV_ABORTED" and self.led_on:
                self._publish_color(self.active_color)
                self._publish_color((0, 0, 0))
                self._publish_color(self.active_color)
            else:
                self._publish_color(self.active_color if self.led_on else (0, 0, 0))

    def _persist_timer_cb(self):
        """Houdt de LED-kleur actief bij vaste standen (geen knipper)."""
        active_state = self.error if self.error else self.state
        if active_state not in self.blink_modes:
            self._publish_color(self.active_color)

    def _publish_color(self, rgb):
        """Publiceert een kleur naar de LED-ring."""
        r, g, b = rgb
        leds = LightringLeds()
        leds.header.stamp = self.get_clock().now().to_msg()
        leds.override_system = True
        leds.leds = [LedColor(red=int(r), green=int(g), blue=int(b)) for _ in range(6)]
        self.led_pub.publish(leds)

    # ============================================================
    # HULPFUNCTIES
    # ============================================================

def main(args=None):
    rclpy.init(args=args)
    node = BehaviorManager()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()


if __name__ == '__main__':
    main()

