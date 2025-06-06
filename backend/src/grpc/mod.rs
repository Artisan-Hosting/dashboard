pub mod secret_service {
    tonic::include_proto!("secret_service");
}

use secret_service::secret_service_client::SecretServiceClient;
use tonic::transport::Channel;
use artisan_middleware::dusa_collection_utils::{core::logger::LogLevel, log};

#[derive(Clone)]
pub struct SecretClient {
    client: SecretServiceClient<Channel>,
}

impl SecretClient {
    pub async fn connect(addr: String) -> Result<Self, tonic::transport::Error> {
        log!(LogLevel::Info, "connecting SecretService gRPC at {}", addr);
        let client = SecretServiceClient::connect(addr.clone()).await?;
        log!(LogLevel::Info, "connected gRPC at {}", addr);
        Ok(Self { client })
    }

    pub async fn create_secret(&mut self, req: secret_service::CreateSecretRequest)
        -> Result<secret_service::SimpleSecretResponse, tonic::Status>
    {
        log!(LogLevel::Debug, "gRPC create_secret");
        Ok(self.client.create_secret(req).await?.into_inner())
    }

    pub async fn get_all_secrets(&mut self, req: secret_service::GetAllSecretsRequest)
        -> Result<secret_service::GetAllSecretsResponse, tonic::Status>
    {
        log!(LogLevel::Debug, "gRPC get_all_secrets");
        Ok(self.client.get_all_secrets(req).await?.into_inner())
    }
}
