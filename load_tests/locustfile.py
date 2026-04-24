"""
locustfile.py — Testes de Carga XiaoLee

Cenários cobertos:
    1. XiaoLeeCriticalPath — fluxo completo de campanha (join → verify → claim)
    2. XiaoLeeReadOnly     — endpoints de leitura (health, metrics, status, campaigns)
    3. XiaoLeeChat         — simulação de mensagens do agente

Meta de SLA (Mainnet):
    - p50 < 200ms
    - p95 < 500ms
    - p99 < 1000ms
    - Error rate < 1%

Execução rápida (validação local):
    cd backend && locust -f ../load_tests/locustfile.py \\
        --host=http://localhost:8000 \\
        --users=10 --spawn-rate=2 --run-time=60s --headless

Execução de carga (staging):
    locust -f load_tests/locustfile.py \\
        --host=https://api-staging.xiaolee.io \\
        --users=100 --spawn-rate=10 --run-time=300s --headless \\
        --html=load_tests/reports/report_$(date +%Y%m%d_%H%M%S).html

Ver interface web:
    locust -f load_tests/locustfile.py --host=http://localhost:8000
    # Abrir: http://localhost:8089
"""

from __future__ import annotations

import random
import string
import time
from locust import HttpUser, task, between, events
from locust.runners import MasterRunner


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _random_session_id() -> str:
    return "loadtest_" + "".join(random.choices(string.ascii_lowercase + string.digits, k=16))


def _random_twitter_id() -> str:
    return f"@loadtest_user_{random.randint(100000, 999999)}"


def _random_campaign_id() -> str:
    return str(random.randint(1, 5))


# ─── Usuário: Fluxo Crítico de Campanha ───────────────────────────────────────

class XiaoLeeCriticalPath(HttpUser):
    """
    Simula o fluxo completo de um usuário em uma campanha:
        1. Health check
        2. Join campanha
        3. Verify tarefas
        4. Claim recompensa

    Este cenário representa o caminho crítico de receita do protocolo.
    SLA mais exigente: p95 < 500ms em cada etapa.
    """

    wait_time = between(1, 3)  # espera 1-3s entre tarefas
    weight = 3  # proporção relativa de usuários neste cenário

    def on_start(self):
        """Setup por usuário virtual."""
        self.session_id = _random_session_id()
        self.campaign_id = _random_campaign_id()
        self.auth_headers = {"Authorization": f"Bearer {self.session_id}"}

    @task(1)
    def health_check(self):
        """GET /health — gateway de disponibilidade."""
        with self.client.get("/health", name="GET /health", catch_response=True) as resp:
            if resp.status_code == 200:
                resp.success()
            elif resp.status_code == 503:
                resp.failure(f"Service degraded: {resp.text[:100]}")
            else:
                resp.failure(f"Unexpected status: {resp.status_code}")

    @task(3)
    def join_campaign(self):
        """POST /campaigns/join — entrada na campanha."""
        payload = {"campaign_identifier": self.campaign_id}
        with self.client.post(
            "/campaigns/join",
            json=payload,
            headers=self.auth_headers,
            name="POST /campaigns/join",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 409):
                # 409 = já inscrito — comportamento correto, não é erro
                resp.success()
            elif resp.status_code == 401:
                resp.failure("Unauthorized (expected in load test — session not real)")
            else:
                resp.failure(f"status={resp.status_code} body={resp.text[:100]}")

    @task(2)
    def verify_campaign(self):
        """POST /campaigns/verify — verificação de tarefas."""
        with self.client.post(
            "/campaigns/verify",
            json={"campaign_identifier": self.campaign_id},
            headers=self.auth_headers,
            name="POST /campaigns/verify",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 400, 401):
                resp.success()
            else:
                resp.failure(f"status={resp.status_code}")

    @task(1)
    def claim_campaign(self):
        """POST /campaigns/claim — claim de recompensa."""
        with self.client.post(
            "/campaigns/claim",
            json={"campaign_identifier": self.campaign_id},
            headers=self.auth_headers,
            name="POST /campaigns/claim",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 400, 401):
                resp.success()
            else:
                resp.failure(f"status={resp.status_code}")


# ─── Usuário: Endpoints de Leitura ────────────────────────────────────────────

class XiaoLeeReadOnly(HttpUser):
    """
    Simula usuários que apenas consultam dados (dashboards, monitores).
    Alta frequência, baixa carga no banco.
    """

    wait_time = between(0.5, 2)
    weight = 5

    @task(3)
    def status(self):
        self.client.get("/status", name="GET /status")

    @task(2)
    def health(self):
        with self.client.get("/health", name="GET /health", catch_response=True) as resp:
            if resp.status_code in (200, 503):
                resp.success()

    @task(1)
    def health_detailed(self):
        with self.client.get(
            "/health/detailed",
            name="GET /health/detailed",
            catch_response=True
        ) as resp:
            if resp.status_code in (200, 503):
                resp.success()

    @task(2)
    def list_campaigns(self):
        with self.client.get(
            "/campaigns",
            headers={"Authorization": "Bearer loadtest_readonly"},
            name="GET /campaigns",
            catch_response=True,
        ) as resp:
            if resp.status_code in (200, 401):
                resp.success()

    @task(1)
    def metrics(self):
        with self.client.get("/metrics", name="GET /metrics", catch_response=True) as resp:
            if resp.status_code == 200:
                resp.success()


# ─── Usuário: Chat/Agente ─────────────────────────────────────────────────────

class XiaoLeeChat(HttpUser):
    """
    Simula interações com o agente Gemini via POST /chat.
    Menor frequência — chamadas têm latência maior (LLM inference).
    """

    wait_time = between(3, 8)
    weight = 1

    MESSAGES = [
        "Qual é o preço do SOL?",
        "Quero fazer um swap de 10 USDC para SOL",
        "Quantas campanhas estão ativas?",
        "Me ajuda a entender como funciona o XiaoLee",
        "Como faço para conectar minha wallet?",
    ]

    def on_start(self):
        self.session_id = _random_session_id()
        self.twitter_id = _random_twitter_id()

    @task
    def chat_message(self):
        message = random.choice(self.MESSAGES)
        with self.client.post(
            "/chat",
            json={
                "session_id": self.session_id,
                "twitter_id": self.twitter_id,
                "message": message,
            },
            name="POST /chat",
            catch_response=True,
            timeout=30,  # LLM pode demorar mais
        ) as resp:
            if resp.status_code in (200, 400, 422):
                resp.success()
            else:
                resp.failure(f"status={resp.status_code}")


# ─── Hooks de Relatório ───────────────────────────────────────────────────────

@events.quitting.add_listener
def on_quitting(environment, **kwargs):
    """Imprime resumo de SLA ao final do teste."""
    stats = environment.runner.stats
    total = stats.total

    print("\n" + "═" * 60)
    print("📊 XiaoLee Load Test — Resumo de SLA")
    print("═" * 60)
    print(f"  Requests totais : {total.num_requests:,}")
    print(f"  Falhas          : {total.num_failures:,} ({total.fail_ratio:.1%})")
    print(f"  p50 (mediana)   : {total.get_response_time_percentile(0.50):.0f}ms")
    print(f"  p95             : {total.get_response_time_percentile(0.95):.0f}ms")
    print(f"  p99             : {total.get_response_time_percentile(0.99):.0f}ms")
    print(f"  RPS médio       : {total.current_rps:.1f}")

    # Validação de SLA
    p95 = total.get_response_time_percentile(0.95)
    fail_rate = total.fail_ratio
    sla_ok = p95 < 500 and fail_rate < 0.01

    print("\n  SLA Mainnet:")
    print(f"  {'✅' if p95 < 500 else '❌'} p95 < 500ms  (atual: {p95:.0f}ms)")
    print(f"  {'✅' if fail_rate < 0.01 else '❌'} Error rate < 1%  (atual: {fail_rate:.1%})")
    print(f"\n  {'🟢 SLA OK — PRONTO PARA MAINNET' if sla_ok else '🔴 SLA VIOLADO — revisar antes do mainnet'}")
    print("═" * 60 + "\n")

    # Exit code non-zero se SLA violado (útil em CI)
    if not sla_ok:
        environment.process_exit_code = 1
