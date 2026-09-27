import { createApp } from '@backstage/frontend-defaults';
import {
  configApiRef,
  githubAuthApiRef,
  SignInPageProps,
  useApi,
} from '@backstage/core-plugin-api';
import { SignInPage } from '@backstage/core-components';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { SignInPageBlueprint } from '@backstage/plugin-app-react';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import scaffolderPlugin from '@backstage/plugin-scaffolder/alpha';
import { navModule } from './modules/nav';
import { homeModule } from './modules/home';

const EnvironmentSignInPage = (props: SignInPageProps) => {
  const config = useApi(configApiRef);
  const environment = config.getOptionalString('auth.environment');

  if (environment === 'development') {
    return <SignInPage {...props} providers={['guest']} />;
  }

  return (
    <SignInPage
      {...props}
      provider={{
        id: 'github-auth-provider',
        title: 'GitHub',
        message: 'Sign in using GitHub',
        apiRef: githubAuthApiRef,
      }}
    />
  );
};

const signInPage = SignInPageBlueprint.make({
  params: {
    loader: async () => EnvironmentSignInPage,
  },
});

export default createApp({
  features: [
    catalogPlugin,
    scaffolderPlugin,
    navModule,
    homeModule,
    createFrontendModule({
      pluginId: 'app',
      extensions: [signInPage],
    }),
  ],
});
