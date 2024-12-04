import { mConStr1, stringToHex } from "@meshsdk/core";
import {
  blockchainProvider,
  getAddress,
  getCollateral,
  getUtxos,
  initWallet,
  txBuilder,
} from "./setup.ts";
import blueprint from "./plutus.json" with { type: "json" };
import { builtinByteString, integer, outputReference } from "@meshsdk/common";
import type { UTxO } from "@meshsdk/common";

import {
  applyParamsToScript,
  BlockfrostProvider,
  MeshTxBuilder,
  MeshWallet,
  resolveScriptHash,
  serializePlutusScript,
} from "@meshsdk/core";
import { BrowserWalletState } from "./state/browser-wallet-state.svelte.ts";

export async function burn(policy: string, tokenName: string) {
  const tokenNameHex = stringToHex(tokenName);

  const utxos = await BrowserWalletState.wallet.getUtxos();
  // let unLockAssetUtxo: UTxO;

  // let count = 0;
  // utxos.forEach((e: UTxO) => {
  //   e.output.amount.forEach((asset: any) => {
  //     if (asset.unit.includes(policy + tokenNameHex)) {
  //       unLockAssetUtxo = e;
  //       console.log(count);
  //     }
  //   });
  //   count++;
  // });

  const wallet1Address = await BrowserWalletState.wallet.getChangeAddress();

  // console.log("nftToUnLock:", unLockAssetUtxo);

  console.log("token:", tokenName);
  console.log("tokenHex:", tokenNameHex);

  console.log("wallet addy:", wallet1Address);

  console.log(utxos);

  console.log("token:", tokenName);
  console.log("tokenHex:", tokenNameHex);

  console.log("wallet addy:", wallet1Address);

  const paramUtxo = outputReference(
    // unLockAssetUtxo.input.txHash,
    "b3b7b82adc9fcb5d14b193313a4bec8d28d333295f5df91a589c4fc6c1da3d44",
    // unLockAssetUtxo.input.outputIndex,
    0,
  );

  console.log("utxo");
  console.log(paramUtxo);

  // Fract NFT Validator
  const fractNftValidator = blueprint.validators.filter((val) =>
    val.title.includes("fract_nft.mint")
  );
  if (!fractNftValidator) {
    throw new Error("Fract NFT Validator not found!");
  }

  const parameterizedScript = applyParamsToScript(
    fractNftValidator[0].compiledCode,
    [
      builtinByteString(
        "b2af4d6208ee4114c74dc01b7111ba1df61a94a2d7d2fd7c473b139f",
      ),
      builtinByteString("746573745f"),
      integer(100),
      integer(50),
      paramUtxo,
    ],
    "JSON",
  );

  console.log(parameterizedScript);

  const scriptAddr = serializePlutusScript(
    { code: parameterizedScript, version: "V3" },
    undefined,
    0,
  ).address;

  console.log("script address:", scriptAddr, "\n");
  const unLockAssetUtxo = await blockchainProvider.fetchAddressUTxOs(
    scriptAddr,
  );
  const nftToUnLock = unLockAssetUtxo[0];
  const wallet1Collateral = await BrowserWalletState.wallet.getCollateral();
  const wallet1Addy = await BrowserWalletState.wallet.getChangeAddress();

  const fractPolicyId = resolveScriptHash(parameterizedScript, "V3");
  console.log("fractPolicyId:", fractPolicyId);

  console.log("policy:");
  console.log(policy);
  console.log("Col:", wallet1Collateral[0]);

  const unsignedTx = await txBuilder
    .spendingPlutusScriptV3()
    .txIn(
      nftToUnLock.input.txHash,
      nftToUnLock.input.outputIndex,
      nftToUnLock.output.amount,
      nftToUnLock.output.address,
    )
    .txInScript(parameterizedScript)
    .spendingReferenceTxInInlineDatumPresent()
    .spendingReferenceTxInRedeemerValue("")
    .mintPlutusScriptV3()
    .mint("-50", fractPolicyId, tokenNameHex)
    .mintingScript(parameterizedScript)
    .mintRedeemerValue(mConStr1([]))
    .txOut(wallet1Addy, [])
    .changeAddress(wallet1Addy)
    .selectUtxosFrom(utxos)
    .txInCollateral(
      wallet1Collateral[0].input.txHash,
      wallet1Collateral[0].input.outputIndex,
      wallet1Collateral[0].output.amount,
      wallet1Collateral[0].output.address,
    )
    .complete();

  const signedTx = await BrowserWalletState.wallet.signTx(unsignedTx);
  const txHash = await BrowserWalletState.wallet.submitTx(signedTx);

  console.log("my fract burned tx hash:", txHash);
}
