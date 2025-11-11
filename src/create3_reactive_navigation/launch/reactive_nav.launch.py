from launch import LaunchDescription
from launch_ros.actions import Node
import os

def generate_launch_description():
    # pad naar je parameterbestand
    config_file = os.path.join(
        os.getenv('HOME'),
        'create3_ws',
        'src',
        'create3_reactive_navigation',
        'config',
        'nav_params.yaml'
    )

    return LaunchDescription([
        Node(
            package='create3_reactive_navigation',
            executable='navigation_node',
            name='navigation_node',
            parameters=[config_file],
            output='screen'
        ),
        Node(
            package='create3_reactive_navigation',
            executable='obstacle_avoidance_node',
            name='obstacle_avoidance_node',
            parameters=[config_file],
            output='screen'
        ),
        Node(
            package='create3_reactive_navigation',
            executable='behavior_manager',
            name='behavior_manager',
            parameters=[config_file],
            output='screen'
        ),
    ])
