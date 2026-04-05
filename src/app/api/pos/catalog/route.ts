import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SquareClient, SquareEnvironment } from "square";

function getSquare() {
  return new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN!,
    environment: SquareEnvironment.Production,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const square = getSquare();

  try {
    const catalogPage = await square.catalog.list({ types: "ITEM" });
    const items = catalogPage.data || [];

    const services = items
      .filter((obj) => obj.type === "ITEM")
      .map((obj) => {
        // Cast to access itemData on the ITEM variant of the discriminated union
        const itemObj = obj as unknown as {
          id: string;
          type: string;
          itemData?: {
            name?: string;
            variations?: Array<{
              id: string;
              itemVariationData?: {
                name?: string;
                priceMoney?: { amount?: bigint | number; currency?: string };
              };
            }>;
          };
        };
        const item = itemObj.itemData;
        if (!item) return null;
        const variations = (item.variations || []).map((v) => {
          const vData = v.itemVariationData;
          const priceMoney = vData?.priceMoney;
          return {
            id: v.id,
            name: vData?.name || "Default",
            price: priceMoney ? Number(priceMoney.amount) / 100 : 0,
          };
        });
        return {
          id: itemObj.id,
          name: item.name || "Unnamed Service",
          variations,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ services });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ services: [], error: msg }, { status: 500 });
  }
}
