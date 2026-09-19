"use client";

import { removeTransaction } from "@/app/transactions/actions";
import ConfirmDeleteButton from "@/components/ConfirmDeleteButton";

export default function DeleteTransactionButton({
  transactionId,
}: {
  transactionId: string;
}) {
  return <ConfirmDeleteButton onConfirm={() => removeTransaction(transactionId)} />;
}
