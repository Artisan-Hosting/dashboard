pub mod secret_service {
    tonic::include_proto!("secret_service");
}

use secret_service::secret_service_client::SecretServiceClient;
use tonic::transport::Channel;

#[derive(Clone)]
pub struct SecretClient {
    client: SecretServiceClient<Channel>,
}

impl SecretClient {
    pub async fn connect(addr: String) -> Result<Self, tonic::transport::Error> {
        let client = SecretServiceClient::connect(addr).await?;
        Ok(Self { client })
    }

    pub async fn create_secret(&mut self, req: secret_service::CreateSecretRequest)
        -> Result<secret_service::SimpleSecretResponse, tonic::Status>
    {
        Ok(self.client.create_secret(req).await?.into_inner())
    }

    pub async fn get_all_secrets(&mut self, req: secret_service::GetAllSecretsRequest)
        -> Result<secret_service::GetAllSecretsResponse, tonic::Status>
    {
        Ok(self.client.get_all_secrets(req).await?.into_inner())
    }
}
