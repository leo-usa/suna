"""
Step 9: Dobby Admin API Key
"""

from setup.steps.base import BaseStep, StepResult
from setup.utils.secrets import generate_admin_api_key


class DobbyStep(BaseStep):
    """Auto-generate Dobby admin API key."""

    name = "dobby"
    display_name = "Dobby Admin API Key"
    order = 9
    required = True
    depends_on = ["requirements"]

    def run(self) -> StepResult:
        # Always generate a new key (overwrite existing if any)
        self.info("Generating a secure admin API key for Dobby administrative functions...")

        self.config.dobby.DOBBY_ADMIN_API_KEY = generate_admin_api_key()

        self.success("Dobby admin API key generated.")
        self.success("Dobby admin configuration saved.")

        return StepResult.ok(
            "Dobby admin key generated",
            {"dobby": self.config.dobby.model_dump()},
        )

    def get_config_keys(self):
        return ["DOBBY_ADMIN_API_KEY"]

    def is_complete(self) -> bool:
        return bool(self.config.dobby.DOBBY_ADMIN_API_KEY)
