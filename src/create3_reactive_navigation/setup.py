from setuptools import find_packages, setup

package_name = 'create3_reactive_navigation'

setup(
    name=package_name,
    version='0.0.1',
    packages=find_packages(exclude=['test']),
    data_files=[
        # Standaard ROS 2 resource registratie
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        # package.xml
        ('share/' + package_name, ['package.xml']),
        # launch- en config-bestanden opnemen
        ('share/' + package_name + '/launch', ['launch/reactive_nav.launch.py']),
        ('share/' + package_name + '/config', ['config/nav_params.yaml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='mccoy',
    maintainer_email='mccoy@todo.todo',
    description='Reactive navigation nodes for iRobot Create3 (ROS 2 Humble)',
    license='MIT',
    extras_require={
        'test': ['pytest'],
    },
    entry_points={
        'console_scripts': [
            'navigation_node = create3_reactive_navigation.nodes.navigation_node:main',
            'obstacle_avoidance_node = create3_reactive_navigation.nodes.obstacle_avoidance_node:main',
            'behavior_manager = create3_reactive_navigation.nodes.behavior_manager:main',
            'send_route = create3_reactive_navigation.nodes.send_route:main',
        ],
    },
)

