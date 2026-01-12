import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTableList, getTableData, getTableColumns, TableName } from "@/lib/databaseExplorer";
import { DatabaseExplorerClient } from "@/components/DatabaseExplorerClient";

export const dynamic = 'force-dynamic';

interface PageProps {
    searchParams: Promise<{ table?: string }>;
}

export default async function DatabaseExplorerPage({ searchParams }: PageProps) {
    const session = await auth();
    if (!session?.user) redirect("/?login=true");

    const params = await searchParams;
    const selectedTable = (params.table as TableName) || 'User';

    const [tables, data] = await Promise.all([
        getTableList(),
        getTableData(selectedTable)
    ]);

    const columns = getTableColumns(selectedTable);

    return (
        <DatabaseExplorerClient
            tables={tables}
            initialTable={selectedTable}
            initialData={data}
            initialColumns={columns}
        />
    );
}
