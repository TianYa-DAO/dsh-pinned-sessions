/**
 * Host half of dsh-pinned-sessions.
 *
 * The feature is entirely client-side: it reads Session and Workspace state
 * through the Client's root-standard hooks and renders into the sidebar's
 * workspaces region. This row only carries the package into the plugin graph
 * so the Client registry can serve ./client.js beside it.
 */

/** Plugin name shown by the loader. */
export const name = 'pinned-sessions'

/** Host-plane entry point; this plugin owns no Host behavior. */
export function apply() {}
