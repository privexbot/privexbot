"""
Graph Builder - Build and validate chatflow graphs.

WHY:
- Convert node/edge config to executable graph
- Validate workflow structure
- Detect cycles and issues
- Topological sorting

HOW:
- Parse nodes and edges
- Build adjacency list
- Validate connectivity
- Sort for execution

PSEUDOCODE follows the existing codebase patterns.
"""

from typing import List, Dict, Any, Optional, Tuple


class GraphBuilder:
    """
    Build and validate chatflow execution graphs.

    WHY: Convert config to executable workflow
    HOW: Graph analysis and validation
    """

    def build_graph(
        self,
        nodes: List[Dict[str, Any]],
        edges: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Build execution graph from nodes and edges.

        WHY: Prepare chatflow for execution
        HOW: Create adjacency lists and metadata

        ARGS:
            nodes: List of node configurations
            edges: List of edge configurations

        RETURNS:
            {
                "nodes": {...},  # node_id -> node_config
                "adjacency": {...},  # node_id -> [connected_node_ids]
                "start_node": "node_id",
                "end_nodes": ["node_id"],
                "is_valid": True,
                "errors": []
            }
        """

        # Build node lookup
        node_map = {node["id"]: node for node in nodes}

        # Build adjacency list
        adjacency = {node["id"]: [] for node in nodes}
        reverse_adjacency = {node["id"]: [] for node in nodes}

        for edge in edges:
            source = edge["source"]
            target = edge["target"]

            if source in adjacency:
                adjacency[source].append(target)

            if target in reverse_adjacency:
                reverse_adjacency[target].append(source)

        # Find start node (no incoming edges)
        start_nodes = [
            node_id for node_id in node_map.keys()
            if not reverse_adjacency[node_id]
        ]

        # Find end nodes (no outgoing edges)
        end_nodes = [
            node_id for node_id in node_map.keys()
            if not adjacency[node_id]
        ]

        # Validate
        is_valid, errors = self.validate_graph(
            node_map, adjacency, start_nodes, end_nodes
        )

        return {
            "nodes": node_map,
            "adjacency": adjacency,
            "reverse_adjacency": reverse_adjacency,
            "start_node": start_nodes[0] if start_nodes else None,
            "end_nodes": end_nodes,
            "is_valid": is_valid,
            "errors": errors
        }


    def validate_graph(
        self,
        nodes: Dict[str, Any],
        adjacency: Dict[str, List[str]],
        start_nodes: List[str],
        end_nodes: List[str]
    ) -> Tuple[bool, List[str]]:
        """
        Validate chatflow graph structure.

        WHY: Catch configuration errors
        HOW: Check for common issues

        RETURNS:
            (is_valid, error_messages)
        """

        errors = []

        # Check for start node
        if not start_nodes:
            errors.append("No start node found (node with no incoming edges)")
        elif len(start_nodes) > 1:
            errors.append(f"Multiple start nodes found: {start_nodes}")

        # Check for end node
        if not end_nodes:
            errors.append("No end node found (node with no outgoing edges)")

        # Check for cycles
        has_cycle, cycle_nodes = self.detect_cycle(adjacency)
        if has_cycle:
            errors.append(f"Cycle detected in graph: {cycle_nodes}")

        # Check for disconnected nodes
        if start_nodes:
            reachable = self.get_reachable_nodes(start_nodes[0], adjacency)
            disconnected = set(nodes.keys()) - reachable - {start_nodes[0]}

            if disconnected:
                errors.append(f"Disconnected nodes found: {list(disconnected)}")

        # Check for required node types
        has_trigger = any(node["type"] == "trigger" for node in nodes.values())
        has_response = any(node["type"] == "response" for node in nodes.values())

        if not has_trigger:
            errors.append("No trigger node found")
        if not has_response:
            errors.append("No response node found")

        return len(errors) == 0, errors


    def detect_cycle(
        self,
        adjacency: Dict[str, List[str]]
    ) -> Tuple[bool, Optional[List[str]]]:
        """
        Detect cycles in graph using DFS.

        WHY: Cycles cause infinite loops
        HOW: Depth-first search with visited tracking

        RETURNS:
            (has_cycle, cycle_nodes)
        """

        visited = set()
        rec_stack = set()
        cycle_path = []

        def dfs(node: str, path: List[str]) -> bool:
            visited.add(node)
            rec_stack.add(node)
            path.append(node)

            for neighbor in adjacency.get(node, []):
                if neighbor not in visited:
                    if dfs(neighbor, path):
                        return True
                elif neighbor in rec_stack:
                    # Cycle detected
                    cycle_start = path.index(neighbor)
                    cycle_path.extend(path[cycle_start:])
                    return True

            rec_stack.remove(node)
            path.pop()
            return False

        for node in adjacency.keys():
            if node not in visited:
                if dfs(node, []):
                    return True, cycle_path

        return False, None


    def get_reachable_nodes(
        self,
        start_node: str,
        adjacency: Dict[str, List[str]]
    ) -> set:
        """
        Get all nodes reachable from start node.

        WHY: Find disconnected nodes
        HOW: BFS traversal

        RETURNS:
            Set of reachable node IDs
        """

        reachable = set()
        queue = [start_node]

        while queue:
            node = queue.pop(0)

            if node in reachable:
                continue

            reachable.add(node)

            for neighbor in adjacency.get(node, []):
                if neighbor not in reachable:
                    queue.append(neighbor)

        return reachable


    def topological_sort(
        self,
        nodes: Dict[str, Any],
        adjacency: Dict[str, List[str]]
    ) -> Optional[List[str]]:
        """
        Topological sort of nodes for execution order.

        WHY: Determine execution sequence
        HOW: Kahn's algorithm

        RETURNS:
            Sorted list of node IDs or None if cycle exists
        """

        # Calculate in-degrees
        in_degree = {node_id: 0 for node_id in nodes.keys()}
        for node_id in nodes.keys():
            for neighbor in adjacency.get(node_id, []):
                in_degree[neighbor] += 1

        # Queue nodes with no incoming edges
        queue = [node_id for node_id, degree in in_degree.items() if degree == 0]
        sorted_nodes = []

        while queue:
            node = queue.pop(0)
            sorted_nodes.append(node)

            # Reduce in-degree for neighbors
            for neighbor in adjacency.get(node, []):
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        # If not all nodes processed, there's a cycle
        if len(sorted_nodes) != len(nodes):
            return None

        return sorted_nodes


    def get_execution_path(
        self,
        start_node: str,
        end_node: str,
        adjacency: Dict[str, List[str]]
    ) -> Optional[List[str]]:
        """
        Find path from start to end node.

        WHY: Visualize execution flow
        HOW: BFS path finding

        RETURNS:
            List of node IDs forming path or None if no path
        """

        if start_node == end_node:
            return [start_node]

        visited = set()
        queue = [(start_node, [start_node])]

        while queue:
            node, path = queue.pop(0)

            if node in visited:
                continue

            visited.add(node)

            if node == end_node:
                return path

            for neighbor in adjacency.get(node, []):
                if neighbor not in visited:
                    queue.append((neighbor, path + [neighbor]))

        return None


# Global instance
graph_builder = GraphBuilder()
