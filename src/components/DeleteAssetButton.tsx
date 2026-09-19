"use client";

import { removeAsset } from "@/app/assets/actions";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";

export default function DeleteAssetButton({
  assetId,
  assetName,
  hasTransactions,
}: {
  assetId: string;
  assetName: string;
  hasTransactions: boolean;
}) {
  return (
    <ConfirmDeleteButton
      onConfirm={() => removeAsset(assetId)}
      title={
        hasTransactions
          ? `"${assetName}" มีธุรกรรมบันทึกไว้แล้ว ลบสินทรัพย์จะลบประวัติธุรกรรมทั้งหมดของสินทรัพย์นี้ด้วย`
          : undefined
      }
    />
  );
}
