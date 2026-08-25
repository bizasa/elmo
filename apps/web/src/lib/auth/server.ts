/**
 * Auth instance for the web app.
 *
 * Created once at module scope using the shared factory from @workspace/lib,
 * with deployment-specific options injected based on DEPLOYMENT_MODE.
 *
 * This is the single source of truth for the server-side auth object.
 * All server functions, middleware, and route handlers import from here.
 */
import { getCloudAuthOptions } from "@workspace/cloud/auth-hooks";
import { type CreateAuthOptions, createAuth } from "@workspace/lib/auth/server";
import { countUsers, provisionLocalOrg } from "@workspace/lib/db/provisioning";
import { getWhitelabelAuthOptions } from "@workspace/whitelabel/auth-hooks";

/**
 * Local mode hooks: enforce "exactly one user, with an admin org created
 * atomically on signup". The `before` hook rejects any signup once a user
 * exists; the `after` hook creates the organization and membership.
 *
 * Also applies to direct POST /api/auth/sign-up/email calls — the hooks
 * fire regardless of whether signup is triggered from our UI or a curl.
 */
function getLocalAuthOptions(): CreateAuthOptions {
	const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN;
	const clientId = process.env.CF_ACCESS_OIDC_CLIENT_ID;
	const clientSecret = process.env.CF_ACCESS_OIDC_CLIENT_SECRET;
	const cfAccessEnabled = Boolean(teamDomain && clientId && clientSecret);

	const options: CreateAuthOptions = {
		databaseHooks: {
			user: {
				create: {
					// The bootstrap guard applies only to the interactive
					// email/password sign-up endpoint. SSO (path /sso/callback/...)
					// must stay free to JIT-provision additional users beyond the
					// first, so passwordless staff logins can create their accounts.
					before: async (_user, context) => {
						const path = (context as { path?: string } | undefined)?.path ?? "";
						if (path.includes("/sign-up") && (await countUsers()) > 0) {
							throw new Error("This instance is already bootstrapped. Sign in with the existing account instead.");
						}
					},
					// Only the first email/password signup gets the local org +
					// admin membership. SSO-provisioned users get no membership
					// here — their brand access is granted explicitly via member
					// rows, so a newly logged-in staffer sees nothing until scoped.
					after: async (user, context) => {
						const path = (context as { path?: string } | undefined)?.path ?? "";
						if (path.includes("/sign-up")) {
							await provisionLocalOrg({ userId: user.id });
						}
					},
				},
			},
		},
	};

	// Cloudflare Access as an OIDC identity provider: staff already pass the CF
	// Access gate in front of the app, so this reuses that verified identity for
	// passwordless login (no second OTP for users with a live CF Access session).
	if (cfAccessEnabled) {
		const base = `https://${teamDomain}/cdn-cgi/access/sso/oidc/${clientId}`;
		options.sso = {
			// Only pre-provisioned users may sign in. An unknown email is rejected
			// at the callback (redirected back to the login page with an error)
			// instead of silently creating an empty account that lands the user
			// inside the app with no brand access — which reads as a broken login.
			disableImplicitSignUp: true,
			defaultSSO: [
				{
					providerId: "cf-access",
					domain: teamDomain as string,
					oidcConfig: {
						clientId: clientId as string,
						clientSecret: clientSecret as string,
						issuer: base,
						discoveryEndpoint: `${base}/.well-known/openid-configuration`,
						authorizationEndpoint: `${base}/authorization`,
						tokenEndpoint: `${base}/token`,
						userInfoEndpoint: `${base}/userinfo`,
						jwksEndpoint: `${base}/jwks`,
						tokenEndpointAuthentication: "client_secret_post",
						pkce: true,
						scopes: ["openid", "email", "profile"],
					},
				},
			],
		};
	}

	return options;
}

function getDeploymentAuthOptions(): CreateAuthOptions | undefined {
	switch (process.env.DEPLOYMENT_MODE) {
		case "whitelabel":
			return getWhitelabelAuthOptions();
		case "demo":
			// Signup is disabled. Demo deployments reuse a database previously
			// bootstrapped in local mode; visitors can only sign in as that
			// pre-existing user.
			return { disableSignUp: true };
		case "cloud": {
			// Full cloud auth stack (email verification, Google OAuth, Resend
			// transactional email, team invitations, disposable-domain blocking,
			// invite-only allowlist, and umbrella-org provisioning). The cloud
			// package owns the entire hook chain — this case is a single call.
			return getCloudAuthOptions();
		}
		default:
			return getLocalAuthOptions();
	}
}

export const auth = createAuth(getDeploymentAuthOptions());
