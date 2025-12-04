/**
 * Wallet Detection and Management Utilities
 *
 * Provides comprehensive wallet detection, installation guidance,
 * and connection management for multiple blockchain ecosystems.
 */

import { uint8ArrayToBase58 } from "@/utils/encoding";

/**
 * Supported blockchain wallet providers
 */
export type WalletProvider = "evm" | "solana" | "cosmos";

/**
 * Wallet information interface containing all necessary data for wallet display and interaction
 */
export interface WalletInfo {
  /** Unique wallet identifier */
  id: string;
  /** Display name of the wallet */
  name: string;
  /** Emoji icon for the wallet */
  icon: string;
  /** Optional path to wallet logo image */
  iconPath?: string;
  /** URL for wallet installation */
  installUrl: string;
  /** Whether the wallet is currently detected/installed */
  detected: boolean;
  /** Blockchain provider type */
  provider: WalletProvider;
  /** Whether this is a default/recommended wallet for its provider */
  isDefault?: boolean;
}

/**
 * Result of wallet detection process, categorizing wallets by installation status
 */
export interface WalletDetectionResult {
  /** Wallets that are currently installed and detected */
  installed: WalletInfo[];
  /** Wallets that are not installed */
  notInstalled: WalletInfo[];
  /** Recommended wallets for installation (typically default wallets) */
  recommended: WalletInfo[];
}

/**
 * Ethereum wallet provider interface following EIP-1193 standard
 */
export interface EthereumProvider {
  /** Identifies MetaMask wallet */
  isMetaMask?: boolean;
  /** Identifies Coinbase wallet */
  isCoinbaseWallet?: boolean;
  /** Array of providers in multi-wallet scenarios */
  providers?: EthereumProvider[];
  /** Standard EIP-1193 request method */
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

/**
 * Solana wallet provider interface
 */
export interface SolanaProvider {
  /** Identifies Phantom wallet */
  isPhantom?: boolean;
  /** Connect to the wallet and return public key */
  connect: () => Promise<{ publicKey: SolanaPublicKey } | boolean>;
  /** Current connected public key */
  publicKey?: SolanaPublicKey;
  /** Sign a message with the connected wallet */
  signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
}

/**
 * Solana public key interface
 */
export interface SolanaPublicKey {
  /** Convert public key to string representation */
  toString(): string;
}

/**
 * Cosmos wallet provider interface (Keplr/Leap wallets)
 */
export interface CosmosProvider {
  /** Enable wallet for specific chain */
  enable: (chainId: string) => Promise<void>;
  /** Get wallet key information for specific chain */
  getKey: (chainId: string) => Promise<{
    bech32Address: string;
    pubKey: string;
  }>;
  /** Sign arbitrary message for specific chain */
  signArbitrary: (chainId: string, address: string, message: string) => Promise<{
    signature: string;
    pub_key: { value: string };
  }>;
}


/**
 * Wallet configurations for all supported wallets
 * Only includes wallets with unique detection methods
 */
export const WALLET_CONFIGS: Record<string, Omit<WalletInfo, "detected">> = {
  metamask: {
    id: "metamask",
    name: "MetaMask",
    icon: "🦊",
    iconPath: "/docs/pages/v2/signin/metamask-wallet.png",
    installUrl: "https://metamask.io/download/",
    provider: "evm",
    isDefault: true,
  },
  coinbase: {
    id: "coinbase",
    name: "Coinbase",
    icon: "🔵",
    iconPath: "/docs/pages/v2/signin/coinbase-wallet.png",
    installUrl: "https://www.coinbase.com/wallet",
    provider: "evm",
  },
  phantom: {
    id: "phantom",
    name: "Phantom",
    icon: "👻",
    iconPath: "/docs/pages/v2/signin/Phantom-wallet.png",
    installUrl: "https://phantom.app/download",
    provider: "solana",
    isDefault: true,
  },
  solflare: {
    id: "solflare",
    name: "Solflare",
    icon: "☀️",
    iconPath: "/docs/pages/v2/signin/solflare.png",
    installUrl:
      "https://chromewebstore.google.com/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic?pli=1",
    provider: "solana",
  },
  keplr: {
    id: "keplr",
    name: "Keplr",
    icon: "🌌",
    iconPath: "/docs/pages/v2/signin/keplr-wallet.png",
    installUrl: "https://www.keplr.app/download",
    provider: "cosmos",
    isDefault: true,
  },
  leap: {
    id: "leap",
    name: "Leap",
    icon: "🚀",
    iconPath: "/docs/pages/v2/signin/leap.png",
    installUrl: "https://www.leapwallet.io/download",
    provider: "cosmos",
  },
};

/**
 * Primary wallets to display in the left column (as per design)
 * These are the main recommended wallets for each blockchain ecosystem
 */
export const PRIMARY_WALLETS = ["keplr", "phantom", "metamask"] as const;

/**
 * Get primary wallet configs for left column display
 * @returns Array of primary wallet configurations with detection set to false
 */
export function getPrimaryWallets(): WalletInfo[] {
  return PRIMARY_WALLETS.map((id) => ({
    ...WALLET_CONFIGS[id],
    detected: false, // Will be updated by detection
  }));
}

/**
 * Get all wallet configurations for search functionality
 * @returns Array of all wallet configurations with detection set to false
 */
export function getAllWalletsForSearch(): WalletInfo[] {
  return Object.values(WALLET_CONFIGS).map((config) => ({
    ...config,
    detected: false, // Will be updated by detection
  }));
}

/**
 * Helper function to check wallet detection and categorize into appropriate lists
 * @param walletConfig - The wallet configuration object
 * @param isDetected - Whether the wallet is currently detected/installed
 * @param result - The detection result object to update with categorized wallet
 */
function categorizeWallet(
  walletConfig: Omit<WalletInfo, "detected">,
  isDetected: boolean,
  result: WalletDetectionResult
): void {
  const walletInfo = { ...walletConfig, detected: isDetected };

  if (isDetected) {
    result.installed.push(walletInfo);
  } else {
    result.notInstalled.push(walletInfo);
    if (walletInfo.isDefault) {
      result.recommended.push(walletInfo);
    }
  }
}

/**
 * Detect installed wallets and provide installation guidance
 * @returns Object containing categorized wallet lists (installed, not installed, recommended)
 */
export function detectWallets(): WalletDetectionResult {
  const result: WalletDetectionResult = {
    installed: [],
    notInstalled: [],
    recommended: []
  };

  // Detect wallets using a more efficient approach
  const detections = {
    metamask: !!window.ethereum?.isMetaMask,
    coinbase: !!window.ethereum?.isCoinbaseWallet,
    phantom: !!window.solana?.isPhantom,
    solflare: !!window.solflare?.isSolflare,
    keplr: !!window.keplr,
    leap: !!window.leap
  };

  // Categorize each wallet
  Object.entries(detections).forEach(([walletId, isDetected]) => {
    const walletConfig = WALLET_CONFIGS[walletId];
    if (walletConfig) {
      categorizeWallet(walletConfig, isDetected, result);
    }
  });

  return result;
}

/**
 * Get provider for a specific wallet
 * @param walletId - The wallet identifier
 * @returns The wallet provider instance or null if not detected
 */
export function getWalletProvider(
  walletId: string
): EthereumProvider | SolanaProvider | CosmosProvider | null {
  switch (walletId) {
    case "metamask":
      if (window.ethereum?.providers) {
        return window.ethereum.providers.find((p: EthereumProvider) => p.isMetaMask) || null;
      }
      return window.ethereum?.isMetaMask ? window.ethereum : null;

    case "coinbase":
      if (window.ethereum?.providers) {
        return window.ethereum.providers.find((p: EthereumProvider) => p.isCoinbaseWallet) || null;
      }
      return window.ethereum?.isCoinbaseWallet ? window.ethereum : null;

    case "phantom":
      return window.solana?.isPhantom ? window.solana : null;

    case "solflare":
      return window.solflare?.isSolflare ? window.solflare : null;

    case "keplr":
      return window.keplr || null;

    case "leap":
      return window.leap || null;

    default:
      return null;
  }
}

/**
 * Connect to EVM wallet
 * @param walletId - The EVM wallet identifier (metamask, coinbase)
 * @returns Promise containing the connected address and provider
 */
export async function connectEVMWallet(walletId: string): Promise<{
  address: string;
  provider: EthereumProvider;
}> {
  const provider = getWalletProvider(walletId) as EthereumProvider;

  if (!provider) {
    throw new Error(
      `${WALLET_CONFIGS[walletId]?.name || "Wallet"} not detected`
    );
  }

  try {
    const accounts = await provider.request({
      method: "eth_requestAccounts",
    });

    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      throw new Error(`No accounts found in ${walletId}. Please ensure the wallet is unlocked and has at least one account.`);
    }

    if (!accounts[0] || typeof accounts[0] !== 'string') {
      throw new Error(`Invalid account format from ${walletId}`);
    }

    const address = accounts[0];

    // Validate EVM address format (should start with 0x and be 42 characters)
    if (!address.startsWith('0x') || address.length !== 42) {
      throw new Error(`Invalid EVM address format from ${walletId}: ${address}`);
    }

    return {
      address,
      provider,
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 4001) {
      throw new Error("User rejected the connection request");
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Connect to Solana wallet
 * @param walletId - The Solana wallet identifier (phantom, solflare)
 * @returns Promise containing the connected address and provider
 */
export async function connectSolanaWallet(walletId: string): Promise<{
  address: string;
  provider: SolanaProvider;
}> {
  const provider = getWalletProvider(walletId) as SolanaProvider;

  if (!provider) {
    throw new Error(
      `${WALLET_CONFIGS[walletId]?.name || "Wallet"} not detected`
    );
  }

  try {
    const resp = await provider.connect();

    // Handle different response structures from Solana wallets
    let publicKey;

    // Check provider.publicKey first (most reliable for Solflare)
    if (provider.publicKey && typeof provider.publicKey === 'object' && typeof provider.publicKey.toString === 'function') {
      publicKey = provider.publicKey;
    } else if (resp && typeof resp === 'object' && 'publicKey' in resp && resp.publicKey && typeof resp.publicKey === 'object' && typeof resp.publicKey.toString === 'function') {
      // Phantom returns {publicKey: PublicKey}
      publicKey = resp.publicKey;
    } else if (resp && typeof resp === 'object' && 'toString' in resp && typeof resp.toString === 'function') {
      // Some wallets might return the PublicKey directly (but not boolean values)
      publicKey = resp as SolanaPublicKey;
    } else {
      console.error(`${walletId} - Unable to extract public key:`);
      console.error('Response:', resp, typeof resp);
      console.error('Provider:', provider);
      console.error('Provider.publicKey:', provider.publicKey, typeof provider.publicKey);
      throw new Error(`Unable to get public key from ${walletId}. Please check if the wallet is properly connected.`);
    }

    if (!publicKey) {
      throw new Error(`No public key found for ${walletId}`);
    }

    if (typeof publicKey.toString !== 'function') {
      throw new Error(`Invalid public key format from ${walletId} - no toString method`);
    }

    const address = publicKey.toString();

    // Additional validation for problematic values
    if (address === 'true' || address === 'false' || address === 'undefined' || address === 'null') {
      throw new Error(`${walletId} returned an invalid address: ${address}. Please try disconnecting and reconnecting your wallet.`);
    }

    // Validate Solana address format (should be base58 encoded, typically 32-44 characters)
    if (!address || typeof address !== 'string' || address.length < 20) {
      throw new Error(`Invalid Solana address format from ${walletId}: ${address}`);
    }

    return {
      address,
      provider,
    };
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 4001) {
      throw new Error("User rejected the connection request");
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Connect to Cosmos wallet
 * @param walletId - The Cosmos wallet identifier (keplr, leap)
 * @param chainId - The chain ID to connect to (defaults to "secret-4")
 * @returns Promise containing the connected address, provider, and public key
 */
export async function connectCosmosWallet(
  walletId: string,
  chainId: string = "secret-4"
): Promise<{
  address: string;
  provider: CosmosProvider;
  publicKey: string;
}> {
  const provider = getWalletProvider(walletId) as CosmosProvider;

  if (!provider) {
    throw new Error(
      `${WALLET_CONFIGS[walletId]?.name || "Wallet"} not detected`
    );
  }

  try {
    await provider.enable(chainId);
    const key = await provider.getKey(chainId);

    if (!key || !key.bech32Address) {
      throw new Error(`Unable to get key from ${walletId}. Please ensure the wallet is unlocked and connected to ${chainId}.`);
    }

    if (!key.pubKey) {
      throw new Error(`Unable to get public key from ${walletId}`);
    }

    const address = key.bech32Address;

    // Validate Cosmos address format (should have proper bech32 format with appropriate length)
    if (!address || address.length < 20) {
      throw new Error(`Invalid Cosmos address format from ${walletId}: ${address}`);
    }

    return {
      address,
      provider,
      publicKey: key.pubKey,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Request rejected")) {
      throw new Error("User rejected the connection request");
    }
    throw error instanceof Error ? error : new Error(errorMessage);
  }
}

/**
 * Sign message with EVM wallet
 * @param provider - The EVM wallet provider
 * @param address - The wallet address
 * @param message - The message to sign
 * @returns Promise containing the signature
 */
export async function signEVMMessage(
  provider: EthereumProvider,
  address: string,
  message: string
): Promise<string> {
  try {
    const signature = await provider.request({
      method: "personal_sign",
      params: [message, address],
    });
    return signature as string;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 4001) {
      throw new Error("User rejected the signature request");
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Sign message with Solana wallet
 * @param provider - The Solana wallet provider
 * @param message - The message to sign
 * @returns Promise containing the signature as base58 string
 */
export async function signSolanaMessage(
  provider: SolanaProvider,
  message: string
): Promise<string> {
  try {
    const encodedMessage = new TextEncoder().encode(message);
    const signedMessage = await provider.signMessage(encodedMessage, "utf8");
    return uint8ArrayToBase58(signedMessage.signature);
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 4001) {
      throw new Error("User rejected the signature request");
    }
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Sign message with Cosmos wallet
 * @param provider - The Cosmos wallet provider
 * @param chainId - The chain ID
 * @param address - The wallet address
 * @param message - The message to sign
 * @returns Promise containing the signature and public key
 */
export async function signCosmosMessage(
  provider: CosmosProvider,
  chainId: string,
  address: string,
  message: string
): Promise<{ signature: string; publicKey: string }> {
  try {
    const signatureResponse = await provider.signArbitrary(
      chainId,
      address,
      message
    );
    return {
      signature: signatureResponse.signature,
      publicKey: signatureResponse.pub_key.value,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Request rejected")) {
      throw new Error("User rejected the signature request");
    }
    throw error instanceof Error ? error : new Error(errorMessage);
  }
}

/**
 * Check if user is on mobile device
 * @returns True if the user agent indicates a mobile device
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Get deep link for mobile wallet connection
 * @param walletId - The wallet identifier
 * @returns Deep link URL for mobile wallet or null if not supported
 */
export function getMobileWalletDeepLink(walletId: string): string | null {
  const mobileLinks: Record<string, string> = {
    metamask: `https://metamask.app.link/dapp/${window.location.host}`,
    phantom: `https://phantom.app/ul/browse/${window.location.href}`,
    keplr: "keplrwallet://",
  };

  return mobileLinks[walletId] || null;
}

// Extend window types with proper wallet provider interfaces
declare global {
  interface Window {
    /** Ethereum provider (MetaMask, Coinbase, etc.) */
    ethereum?: any;
    /** Solana provider (Phantom) */
    solana?: any;
    /** Solflare wallet provider */
    solflare?: any;
    /** Keplr Cosmos wallet provider */
    keplr?: any;
    /** Leap Cosmos wallet provider */
    leap?: any;
  }
}
