"use client";

import { use, useEffect, useState } from "react";
import { multiOwnerPluginActions } from "@alchemy/aa-accounts";
import { alchemyEnhancedApiActions, createModularAccountAlchemyClient } from "@alchemy/aa-alchemy";
import { SmartAccountSigner, checkGasSponsorshipEligibility, sepolia } from "@alchemy/aa-core";
import { Web3AuthSigner } from "@alchemy/aa-signers/web3auth";
import { ImpersonatorIframe, useImpersonatorIframe } from "@impersonator/iframe";
import { Web3Auth } from "@web3auth/modal";
import { Alchemy, Network } from "alchemy-sdk";
import type { NextPage } from "next";
import { set } from "nprogress";
import { encodeFunctionData, parseEther, parseUnits } from "viem";
import { AddressInput } from "~~/components/scaffold-eth";
import { IntegerInput } from "~~/components/scaffold-eth";
import { InputBase } from "~~/components/scaffold-eth";
import { Balance } from "~~/components/scaffold-eth";
import { Address } from "~~/components/scaffold-eth";

const Home: NextPage = () => {
  const [provider, setProvider] = useState<any>(null);
  const [accountAddress, setAccountAddress] = useState<string>("");
  const [uoHash, setUoHash] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [balance, setBalance] = useState<bigint>(0n);
  const [address, setAddress] = useState("");
  const [txValue, setTxValue] = useState<string | bigint>("");
  const { latestTransaction, onUserTxConfirm, onTxReject } = useImpersonatorIframe();

  const alchemy = new Alchemy({
    network: Network.ETH_SEPOLIA,
    apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "",
  });

  const [web3auth, setWeb3auth] = useState(null);
  const [authUser, setauthUser] = useState(false);
  const [userNameAuth, setUserNameAuth] = useState<any>({});

  const createWeb3AuthSigner = async (): Promise<SmartAccountSigner<any>> => {
    const web3AuthSigner = new Web3AuthSigner({
      clientId: "test",
      chainConfig: {
        chainNamespace: "eip155",
      },
    });
    await web3AuthSigner.authenticate();
    setWeb3auth(web3AuthSigner);
    return web3AuthSigner;
  };

  const createWallet = async () => {
    try {
      const chain: typeof sepolia = sepolia;
      const apiKeyAlchemy = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";
      const provider = await createModularAccountAlchemyClient({
        apiKey: apiKeyAlchemy as string,
        chain,
        signer: await createWeb3AuthSigner(),
        gasManagerConfig: {
          policyId: "3fb3b722-dcd8-44ce-9c6f-0060a198d2e3",
        },
      });
      const extendedProvider = provider.extend(alchemyEnhancedApiActions(alchemy));
      console.log(extendedProvider);
      setProvider(extendedProvider);
      console.log("Signer authenticated successfully.");
    } catch (error) {
      console.error("Error during signer authentication:", error);
    }
  };

  useEffect(() => {
    if (provider == null) {
      return;
    }
    async function fetchData() {
      const address = await provider.getAddress();
      const addressBalance = await provider.getBalance({
        address: address,
      });
      const userNameAuth = await web3auth.inner.getUserInfo();
      setUserNameAuth(userNameAuth);
      setAccountAddress(address);
      setBalance(addressBalance);
    }
    fetchData();
  }, [provider]);

  async function disconnect() {
    try {
      const logout = await web3auth.inner.logout();
      setAccountAddress("");
      setBalance(0n);
      setProvider(null);
      console.log("Signer disconnected successfully.", logout);
    } catch (error) {
      console.error("Error during signer disconnection:", error);
    }
  }

  const tokenBalancers = async () => {
    console.log(provider);
    const tokenBalances = await provider.core.getTokenBalances(accountAddress);
    console.log(tokenBalances);
  };

  const webAddress = async () => {
    // extend smart account client with multiOwnerPluginActions to call MultiOwnerPlugin methods
    const pluginActionExtendedClient = provider.extend(multiOwnerPluginActions);

    // owners is an array of the addresses of the account owners
    const owners = await pluginActionExtendedClient.readOwners();
    console.log(owners);
  };

  const transfer = async () => {
    const contractABI = [
      {
        constant: false,
        inputs: [
          {
            name: "_to",
            type: "address",
          },
          {
            name: "_value",
            type: "uint256",
          },
        ],
        name: "transfer",
        outputs: [
          {
            name: "",
            type: "bool",
          },
        ],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ];

    const uoCallData = encodeFunctionData({
      abi: contractABI,
      functionName: "transfer",
      args: [{ address }, parseEther({ txValue }.toString())],
    });
    console.log(uoCallData);

    const { hash } = await provider.sendUserOperation({
      uo: {
        target: { address },
        data: uoCallData,
        value: parseUnits({ txValue }, 18).toString(),
      },
    });
    setUoHash(hash);

    const transactionHash = await provider.waitForUserOperationTransaction({ hash });
    setTxHash(transactionHash);
  };
  useEffect(() => {
    const swap = async () => {
      if (latestTransaction) {
        const transaction = JSON.stringify(latestTransaction, null, 2);
        const transactionData = JSON.parse(transaction);
        async function fetchTransaction() {
          const { hash } = await provider.sendUserOperation({
            uo: [
              {
                target: transactionData.to,
                data: transactionData.data,
                value: transactionData.value,
              },
            ],
          });
          return hash;
        }
        const hash = await fetchTransaction();
        const test = await onUserTxConfirm(hash, latestTransaction?.id);
        console.log(test);
      }
    };
    swap();
  }, [latestTransaction]);

  return (
    <>
      <div className="flex flex-col justify-center items-center h-96">
        {provider == null && (
          <>
            <h1>Welcome to the Web 3</h1>
            <button onClick={createWallet} className="btn btn-active btn-primary">
              Create Wallet
            </button>
          </>
        )}
        {provider && (
          <>
            <div className="flex">
              <div className="card w-96 bg-base-100 shadow-xl">
                {/* <figure className="px-10 pt-10">
                <img src="https://daisyui.com/images/stock/photo-1606107557195-0e29a4b5b4aa.jpg" alt="Shoes" className="rounded-xl" />
              </figure> */}
                <div className="card-body items-center text-center">
                  <h2 className="card-title">Hello, {userNameAuth.name}:</h2>
                  <p>
                    <Address address={accountAddress} />
                  </p>
                  {/* <p>Balance:</p>
                  <p>{balance.toString()}</p> */}
                </div>
              </div>

              {/* <p>User Operation Hash: {uoHash}</p>
<p>Transaction Hash: {txHash}</p> */}

              {/* <Balance address={accountAddress} /> */}
              <div className="card w-96 bg-primary text-primary-content">
                <div className="card-body">
                  <h2 className="card-title">Transfer Tokens</h2>
                  <AddressInput onChange={setAddress} value={address} placeholder="Input your address" />
                  <IntegerInput
                    value={txValue}
                    onChange={updatedTxValue => {
                      setTxValue(updatedTxValue);
                    }}
                    placeholder="value (wei)"
                  />
                  <div className="card-actions justify-center">
                    <button onClick={transfer} className="btn">
                      Transfer
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex row">
                <button onClick={webAddress}>See Owners</button>
                <button onClick={disconnect} className="btn btn-error">
                  Disconnect
                </button>
                <button onClick={tokenBalancers}>TokenBalance</button>
              </div>
            </div>
            <button className="btn" onClick={() => document.getElementById("my_modal_3").showModal()}>
              swap
            </button>
            <dialog id="my_modal_3" className="modal">
              <div className="modal-box">
                {accountAddress != "" && (
                  <div className="w-full rounded-md p-1">
                    <ImpersonatorIframe
                      key={accountAddress}
                      height={"500px"}
                      width={"100%"} //set it to the browser width
                      src="https://app.uniswap.org/swap"
                      address="0x692be0A2Aabb8a72AE17479FC096ce0032e78954"
                      rpcUrl="https://eth-sepolia.g.alchemy.com/v2/zY6lpM4LxhfNqP7Jdh43mbEwsMtwz1uA"
                    />
                  </div>
                )}
              </div>
            </dialog>
          </>
        )}
      </div>
    </>
  );
};

export default Home;
