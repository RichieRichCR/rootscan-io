"use server"
import {isAddress, isHash, isHex} from "viem";
import {getAddressFromRnsName} from "@/lib/api";
import { redirect } from "next/navigation";

export const performSearchMainSearch = async (value: string) => {
  'use server'
  if (!value) return
  // Is Address
  if (isAddress(value)) {
    return redirect(`/addresses/${value}`)
  }
  // Is Tx Hash
  if (isHash(value) && value?.length == 66) {
    return redirect(`/tx/${value}`)
  }

  if (value?.includes("-")) {
    const splitted = value?.split("-")
    if (splitted?.length === 2 || splitted?.length === 3) {
      if (!isNaN(Number(splitted[0])) && !isNaN(Number(splitted[1]))) {
        return redirect(`/extrinsics/${value}`)
      }
    }
  }
  // Is Block
  if (Number.isInteger(parseInt(value)) && !isHex(value)) {
    return redirect(`/blocks/${value}`)
  }

  // Is RNS Name
  const addressFrom = await getAddressFromRnsName(value);
  if(addressFrom) {
    return redirect(`/addresses/${addressFrom}`)
  }

  return 'NOT_FOUND';
}
