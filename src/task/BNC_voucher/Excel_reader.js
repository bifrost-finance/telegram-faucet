import parse from 'csv-parse/lib/sync';
import fs from 'fs';

class ExcelReader {

    async run() {

        // let input = fs.readFileSync('src/task/BNC_voucher/123.csv');
        let input = fs.readFileSync('bnc_voucher.csv');
        let records = parse(input, {
            // columns: header => header.filter(column => column == "nickname" || column == "u_id"),
            columns: true,
            skip_empty_lines: true
        });

        let json_str = JSON.stringify(records, null, "\t");

        // fs.writeFile('src/task/BNC_voucher/bnc_users1.json', json_str, function (err) {
        fs.writeFile('bnc_users.json', json_str, function (err) {
            if (err) {
                console.log(err)
            }
        })
    }
}

const Excel_Reader = new ExcelReader()
Excel_Reader.run()