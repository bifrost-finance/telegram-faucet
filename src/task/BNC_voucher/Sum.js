import DataList from './bnc_users1.json';

class Sum {
    async run() {
        let data = [];
        for (let index = 0; index < DataList.length; index++) {
            data.push(DataList[index]);
        }

        if (data.length > 0) {
            await this.sum_total(data);
        }
    }

    async sum_total(data) {

        let sum = 0;
        for (let index = 0; index < data.length; index++) {

            sum += parseFloat(data[index].amount);

        }

        console.log(sum)
    }
}

const sum = new Sum();
sum.run();