from __future__ import annotations

from collections import defaultdict
from threading import RLock
from typing import DefaultDict, List, Tuple


_lock = RLock()
_request_counts: DefaultDict[Tuple[str, str, int], int] = defaultdict(int)
_request_durations: DefaultDict[Tuple[str, str], List[float]] = defaultdict(list)


def record_http_request(method: str, path: str, status_code: int, duration_seconds: float) -> None:
    key = (method.upper(), path, int(status_code))
    duration_key = (method.upper(), path)

    with _lock:
        _request_counts[key] += 1
        _request_durations[duration_key].append(duration_seconds)


def render_prometheus_metrics() -> str:
    lines = [
        '# HELP xiaolee_http_requests_total Total de requests HTTP processadas.',
        '# TYPE xiaolee_http_requests_total counter',
    ]

    with _lock:
        for (method, path, status_code), count in sorted(_request_counts.items()):
            lines.append(
                f'xiaolee_http_requests_total{{method="{method}",path="{path}",status="{status_code}"}} {count}'
            )

        lines.extend([
            '',
            '# HELP xiaolee_http_request_duration_seconds_avg Tempo medio de resposta por rota.',
            '# TYPE xiaolee_http_request_duration_seconds_avg gauge',
        ])

        for (method, path), durations in sorted(_request_durations.items()):
            if not durations:
                continue
            average_duration = sum(durations) / len(durations)
            lines.append(
                f'xiaolee_http_request_duration_seconds_avg{{method="{method}",path="{path}"}} {average_duration:.6f}'
            )

    lines.append('')
    return "\n".join(lines)


def clear_metrics() -> None:
    with _lock:
        _request_counts.clear()
        _request_durations.clear()