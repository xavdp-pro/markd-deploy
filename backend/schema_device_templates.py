# Device templates for network schema diagrams
# Each template defines device type, ports (WAN/LAN), icon, and default size

from typing import List, Dict, Any

class DevicePort:
    def __init__(self, name: str, port_type: str, position: str):
        self.name = name
        self.type = port_type  # 'WAN' or 'LAN'
        self.position = position  # 'left', 'right', 'top', 'bottom'

class DeviceTemplate:
    def __init__(
        self,
        device_type: str,
        name: str,
        description: str,
        default_ports: List[Dict[str, str]],
        icon_svg: str,
        default_size: Dict[str, int]
    ):
        self.device_type = device_type
        self.name = name
        self.description = description
        self.default_ports = default_ports
        self.icon_svg = icon_svg
        self.default_size = default_size

def get_device_templates() -> List[Dict[str, Any]]:
    """Get all available device templates"""
    templates = []
    
    # Mikrotik RouterOS
    templates.append({
        'device_type': 'mikrotik_routeros',
        'name': 'Mikrotik RouterOS',
        'description': 'Router Mikrotik avec ports WAN/LAN et SFP',
        'default_ports': [
            {'name': 'WAN0', 'type': 'WAN', 'position': 'left'},
            {'name': 'WAN1', 'type': 'WAN', 'position': 'left'},
            {'name': 'LAN2', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN3', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN4', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN5', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN6', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN7', 'type': 'LAN', 'position': 'right'},
            {'name': 'SFP', 'type': 'LAN', 'position': 'top'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#1e3a8a" stroke="#3b82f6" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">Mikrotik</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    # TP-Link Omada
    templates.append({
        'device_type': 'tplink_omada',
        'name': 'TP-Link Omada',
        'description': 'Routeur/AP TP-Link Omada',
        'default_ports': [
            {'name': 'WAN1', 'type': 'WAN', 'position': 'left'},
            {'name': 'LAN2', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN3', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN4', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN5', 'type': 'LAN', 'position': 'right'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#2563eb" stroke="#60a5fa" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">TP-Link</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    # Box Internet
    templates.append({
        'device_type': 'box_internet',
        'name': 'Box Internet',
        'description': 'Box Internet (DSL/Fiber)',
        'default_ports': [
            {'name': 'DSL/Fiber', 'type': 'WAN', 'position': 'left'},
            {'name': 'LAN1', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN2', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN3', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN4', 'type': 'LAN', 'position': 'right'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#7c3aed" stroke="#a78bfa" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">Box</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    # Switch 24 ports
    templates.append({
        'device_type': 'switch_24',
        'name': 'Switch 24 ports',
        'description': 'Switch Ethernet 24 ports',
        'default_ports': [
            {'name': f'Port{i}', 'type': 'LAN', 'position': 'right' if i % 2 == 0 else 'left'} 
            for i in range(1, 25)
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="100" rx="5" fill="#059669" stroke="#10b981" stroke-width="2"/><text x="50" y="60" text-anchor="middle" fill="white" font-size="12" font-weight="bold">Switch 24</text>',
        'default_size': {'width': 100, 'height': 120}
    })
    
    # Switch 48 ports
    templates.append({
        'device_type': 'switch_48',
        'name': 'Switch 48 ports',
        'description': 'Switch Ethernet 48 ports',
        'default_ports': [
            {'name': f'Port{i}', 'type': 'LAN', 'position': 'right' if i % 2 == 0 else 'left'} 
            for i in range(1, 49)
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="140" rx="5" fill="#059669" stroke="#10b981" stroke-width="2"/><text x="50" y="80" text-anchor="middle" fill="white" font-size="12" font-weight="bold">Switch 48</text>',
        'default_size': {'width': 100, 'height': 160}
    })
    
    # IP Phone
    templates.append({
        'device_type': 'phone_ip',
        'name': 'IP Phone',
        'description': 'IP Phone with network port and PC port',
        'default_ports': [
            {'name': 'Network', 'type': 'LAN', 'position': 'left'},
            {'name': 'PC', 'type': 'LAN', 'position': 'right'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#dc2626" stroke="#ef4444" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">Phone</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    # Ordinateur
    templates.append({
        'device_type': 'computer',
        'name': 'Computer',
        'description': 'Desktop or laptop computer',
        'default_ports': [
            {'name': 'Ethernet', 'type': 'LAN', 'position': 'left'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#475569" stroke="#64748b" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">PC</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    # Serveur
    templates.append({
        'device_type': 'server',
        'name': 'Server',
        'description': 'Server with multi-NIC',
        'default_ports': [
            {'name': 'NIC1', 'type': 'LAN', 'position': 'left'},
            {'name': 'NIC2', 'type': 'LAN', 'position': 'left'},
            {'name': 'NIC3', 'type': 'LAN', 'position': 'right'},
            {'name': 'NIC4', 'type': 'LAN', 'position': 'right'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#ea580c" stroke="#f97316" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">Server</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    # Access Point WiFi
    templates.append({
        'device_type': 'ap_wifi',
        'name': 'Access Point WiFi',
        'description': 'WiFi Access Point',
        'default_ports': [
            {'name': 'Ethernet', 'type': 'LAN', 'position': 'bottom'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#0891b2" stroke="#06b6d4" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">WiFi AP</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    # Firewall
    templates.append({
        'device_type': 'firewall',
        'name': 'Firewall',
        'description': 'Firewall avec ports WAN/LAN/DMZ',
        'default_ports': [
            {'name': 'WAN1', 'type': 'WAN', 'position': 'left'},
            {'name': 'WAN2', 'type': 'WAN', 'position': 'left'},
            {'name': 'LAN1', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN2', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN3', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN4', 'type': 'LAN', 'position': 'right'},
            {'name': 'DMZ', 'type': 'LAN', 'position': 'top'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#991b1b" stroke="#dc2626" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">Firewall</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    # Generic Router
    templates.append({
        'device_type': 'router_generic',
        'name': 'Router',
        'description': 'Generic router',
        'default_ports': [
            {'name': 'WAN1', 'type': 'WAN', 'position': 'left'},
            {'name': 'WAN2', 'type': 'WAN', 'position': 'left'},
            {'name': 'LAN1', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN2', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN3', 'type': 'LAN', 'position': 'right'},
            {'name': 'LAN4', 'type': 'LAN', 'position': 'right'},
        ],
        'icon_svg': '<rect x="10" y="10" width="80" height="60" rx="5" fill="#1e40af" stroke="#3b82f6" stroke-width="2"/><text x="50" y="40" text-anchor="middle" fill="white" font-size="12" font-weight="bold">Router</text>',
        'default_size': {'width': 100, 'height': 80}
    })
    
    return templates

def get_template_by_type(device_type: str) -> Dict[str, Any]:
    """Get a specific template by device_type"""
    templates = get_device_templates()
    for template in templates:
        if template['device_type'] == device_type:
            return template
    return None

